const path = require('path');
const crypto = require('crypto');

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XLSX_MIME_TYPES = new Set([
  XLSX_MIME_TYPE,
  'application/octet-stream',
  'application/vnd.ms-excel',
  'binary/octet-stream'
]);
const MAX_EOCD_SEARCH_BYTES = 66_000;

function sanitizeUploadedFilename(originalName) {
  const normalizedName = String(originalName || '').replace(/\\/g, '/');
  const baseName = path.basename(normalizedName).replace(/[\\/]/g, '');
  return baseName || 'upload.xlsx';
}

function hasXlsxExtension(fileName) {
  return path.extname(sanitizeUploadedFilename(fileName)).toLowerCase() === '.xlsx';
}

function createStoredXlsxFilename(originalName) {
  const extension = hasXlsxExtension(originalName) ? '.xlsx' : '';
  return `${crypto.randomUUID()}${extension}`;
}

function isAllowedXlsxMime(mimetype) {
  const type = String(mimetype || '').trim().toLowerCase();
  if (!type) return true;
  return XLSX_MIME_TYPES.has(type);
}

function validateXlsxUploadMetadata(file) {
  if (!file || !hasXlsxExtension(file.originalname)) {
    throw new Error('Only .xlsx format allowed!');
  }
  if (!isAllowedXlsxMime(file.mimetype)) {
    throw new Error('Only .xlsx format allowed!');
  }
}

function findEndOfCentralDirectory(buffer) {
  const minOffset = Math.max(0, buffer.length - MAX_EOCD_SEARCH_BYTES);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }
  return -1;
}

function readZipCentralDirectoryEntries(buffer) {
  if (buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50) {
    throw new Error('Invalid .xlsx file');
  }

  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset === -1) {
    throw new Error('Invalid .xlsx ZIP structure');
  }

  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;

  if (centralDirectoryOffset < 0 || centralDirectoryEnd > buffer.length || centralDirectoryEnd > eocdOffset) {
    throw new Error('Invalid .xlsx ZIP structure');
  }

  const entries = [];
  let offset = centralDirectoryOffset;

  while (offset < centralDirectoryEnd) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('Invalid .xlsx ZIP structure');
    }

    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const fileCommentLength = buffer.readUInt16LE(offset + 32);
    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;

    if (fileNameEnd > buffer.length) {
      throw new Error('Invalid .xlsx ZIP structure');
    }

    entries.push(buffer.toString('utf8', fileNameStart, fileNameEnd));
    offset = fileNameEnd + extraFieldLength + fileCommentLength;
  }

  return entries;
}

function validateXlsxBuffer(buffer) {
  const entries = readZipCentralDirectoryEntries(buffer);
  const hasContentTypes = entries.includes('[Content_Types].xml');
  const hasWorkbook = entries.includes('xl/workbook.xml');

  if (!hasContentTypes || !hasWorkbook) {
    throw new Error('Invalid .xlsx file');
  }
}

module.exports = {
  XLSX_MIME_TYPE,
  XLSX_MIME_TYPES,
  isAllowedXlsxMime,
  sanitizeUploadedFilename,
  hasXlsxExtension,
  createStoredXlsxFilename,
  validateXlsxUploadMetadata,
  validateXlsxBuffer
};
