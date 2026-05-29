const { readFileSync } = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  XLSX_MIME_TYPE,
  sanitizeUploadedFilename,
  createStoredXlsxFilename,
  validateXlsxUploadMetadata,
  validateXlsxBuffer,
  isAllowedXlsxMime
} = require('../server/utils/uploadSecurity');

function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const [name, content = ''] of Object.entries(entries)) {
    const nameBuffer = Buffer.from(name);
    const contentBuffer = Buffer.from(content);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(0, 10);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(contentBuffer.length, 18);
    localHeader.writeUInt32LE(contentBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuffer, contentBuffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(0, 12);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(contentBuffer.length, 20);
    centralHeader.writeUInt32LE(contentBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuffer);

    offset += localHeader.length + nameBuffer.length + contentBuffer.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(Object.keys(entries).length, 8);
  eocd.writeUInt16LE(Object.keys(entries).length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

test('schedule upload rejects invalid MIME types even with .xlsx extension', () => {
  assert.throws(() => validateXlsxUploadMetadata({
    mimetype: 'text/plain',
    originalname: 'schedule.xlsx'
  }), /Only \.xlsx format allowed!/);
});

test('schedule upload accepts octet-stream and empty MIME when extension is .xlsx', () => {
  assert.doesNotThrow(() => validateXlsxUploadMetadata({
    mimetype: 'application/octet-stream',
    originalname: 'schedule.xlsx'
  }));
  assert.doesNotThrow(() => validateXlsxUploadMetadata({
    mimetype: '',
    originalname: 'schedule.xlsx'
  }));
  assert.equal(isAllowedXlsxMime('application/octet-stream'), true);
});

test('schedule upload rejects invalid extensions even with XLSX MIME type', () => {
  assert.throws(() => validateXlsxUploadMetadata({
    mimetype: XLSX_MIME_TYPE,
    originalname: 'schedule.xls'
  }), /Only \.xlsx format allowed!/);
});

test('schedule upload sanitizes path-like filenames and stores under generated UUID names', () => {
  assert.equal(sanitizeUploadedFilename('../nested/..\\evil.xlsx'), 'evil.xlsx');

  const storedName = createStoredXlsxFilename('../nested/..\\evil.xlsx');
  assert.match(storedName, /^[0-9a-f-]{36}\.xlsx$/i);
  assert.equal(storedName.includes('/'), false);
  assert.equal(storedName.includes('\\'), false);
});

test('schedule upload validates XLSX ZIP signature and required workbook entries', () => {
  assert.throws(() => validateXlsxBuffer(Buffer.from('not a zip')), /Invalid \.xlsx/);
  assert.throws(() => validateXlsxBuffer(createZip({ 'not-workbook.txt': 'x' })), /Invalid \.xlsx/);
  assert.doesNotThrow(() => validateXlsxBuffer(createZip({
    '[Content_Types].xml': '<Types></Types>',
    'xl/workbook.xml': '<workbook></workbook>'
  })));
});

test('schedule upload route deletes temporary files on parse failures', () => {
  const source = readFileSync('server/routes/schedule.js', 'utf8');
  assert.match(source, /validateXlsxBuffer\(fs\.readFileSync\(req\.file\.path\)\);[\s\S]*parseScheduleExcel\(req\.file\.path\)/);
  assert.match(source, /catch \(e\) \{[\s\S]*fs\.unlinkSync\(req\.file\.path\);[\s\S]*Error parsing Excel file/);
});
