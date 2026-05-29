const ExcelJS = require('exceljs');

const DAY_KEYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const BASE_SHIFT_BY_SECTION = ['Morning', 'Evening', 'Night'];

function safeCellText(cell) {
  if (!cell) return '';
  try {
    const value = cell.value;
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (value && typeof value === 'object') {
      if (value.text) return String(value.text).trim();
      if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || '').join('').trim();
      if (value.result != null) return String(value.result).trim();
    }
    return (cell.text || '').trim();
  } catch (e) {
    return '';
  }
}

function getCellDate(cell) {
  if (!cell) return null;
  const value = cell.value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (value && value.result instanceof Date && !Number.isNaN(value.result.getTime())) return value.result;
  const numeric = typeof value === 'number' ? value : (value && typeof value.result === 'number' ? value.result : null);
  if (numeric != null && numeric > 30000 && numeric < 60000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const parsed = new Date(excelEpoch.getTime() + Math.round(numeric) * 86400000);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const text = safeCellText(cell);
  if (text) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function isRedSeparatorCell(cell) {
  const fgColor = cell && cell.fill && cell.fill.fgColor;
  const bgColor = cell && cell.fill && cell.fill.bgColor;
  const colors = [fgColor, bgColor].filter(Boolean);
  return colors.some((color) => {
    const argb = String(color.argb || '').toUpperCase();
    return argb === 'FFFF0000' || argb === 'FF0000' || argb.endsWith('FF0000');
  });
}

function isSeparatorRow(row, maxColumn) {
  let redCells = 0;
  for (let c = 1; c <= maxColumn; c += 1) {
    if (isRedSeparatorCell(row.getCell(c))) redCells += 1;
  }
  return redCells >= 3;
}

function normaliseHeader(text) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, '');
}

function findHeader(worksheet) {
  for (let r = 1; r <= Math.min(worksheet.rowCount, 20); r += 1) {
    const row = worksheet.getRow(r);
    const columns = {};
    for (let c = 1; c <= worksheet.columnCount; c += 1) {
      const key = normaliseHeader(safeCellText(row.getCell(c)));
      if (['idno', 'id', 'employeeid', 'empid'].includes(key)) columns.employeeId = c;
      if (['name', 'employeename', 'الاسم'].includes(key)) columns.name = c;
      if (['postion', 'position', 'department', 'job', 'القسم', 'الوظيفة'].includes(key)) columns.department = c;
    }
    if (columns.name && columns.department) return { rowNumber: r, ...columns };
  }
  return null;
}

function findDateRow(worksheet, headerRowNumber, firstDayColumn) {
  for (let r = headerRowNumber; r <= Math.min(worksheet.rowCount, headerRowNumber + 5); r += 1) {
    let dateCount = 0;
    for (let c = firstDayColumn; c <= worksheet.columnCount; c += 1) {
      if (getCellDate(worksheet.getRow(r).getCell(c))) dateCount += 1;
    }
    if (dateCount >= 7) return r;
  }
  return headerRowNumber;
}

function getISOWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function buildWeekDefinitions(worksheet, header, dateRowNumber) {
  const firstDayColumn = header.department + 1;
  const dateRow = worksheet.getRow(dateRowNumber);
  const dateColumns = [];

  for (let c = firstDayColumn; c <= worksheet.columnCount; c += 1) {
    const date = getCellDate(dateRow.getCell(c));
    if (date) dateColumns.push({ column: c, date });
  }

  if (dateColumns.length >= 7) {
    const weekCount = Math.min(2, Math.floor(dateColumns.length / 7));
    const weeks = [];
    for (let w = 0; w < weekCount; w += 1) {
      const columns = dateColumns.slice(w * 7, (w * 7) + 7);
      if (columns.length === 7) {
        weeks.push({
          week_key: getISOWeekKey(columns[0].date),
          week_start: toISODate(columns[0].date),
          columns: columns.map((item, index) => ({ column: item.column, day: DAY_KEYS[index], date: toISODate(item.date) }))
        });
      }
    }
    if (weeks.length) return weeks;
  }

  return [{
    week_key: null,
    week_start: null,
    columns: DAY_KEYS.map((day, index) => ({ column: firstDayColumn + index, day, date: null }))
  }];
}

function normaliseEmployeeId(value) {
  const text = String(value || '').trim();
  if (!text || /^casual$/i.test(text)) return '';
  return text;
}

function normaliseShift(cellText, baseShift) {
  const code = String(cellText || '').trim().toLowerCase();
  if (!code) return baseShift;
  if (code === 'v' || code.startsWith('vac')) return 'Vacation';
  if (code === 'h' || code.startsWith('hol')) return 'Holiday';
  if (code === 'o' || code === 'off' || code.includes('day off')) return 'Off';
  if (code === 'm' || code.startsWith('morning')) return 'Morning';
  if (code === 'a' || code === 'e' || code.startsWith('after') || code.startsWith('evening')) return 'Evening';
  if (code === 'n' || code.startsWith('night')) return 'Night';
  return baseShift;
}

function flattenWeeks(weeks) {
  return weeks.flatMap((week) => week.rows.map((row) => ({
    week_key: week.week_key,
    week_start: week.week_start,
    shiftGroup: row.shiftGroup,
    employeeId: row.employeeId,
    name: row.name,
    department: row.department,
    shifts: row.shifts
  })));
}

/**
 * Parses a Triumph schedule workbook.
 *
 * Supported upload format:
 * - Employee ID, Name and Position columns.
 * - Two consecutive Saturday-Friday week blocks.
 * - Red total rows split the staff list into Morning, Evening/After and Night sections.
 * - Day cells use V = vacation, H = holiday, O = day off; an empty cell means the employee works
 *   the shift implied by the section where their name appears.
 */
async function parseScheduleExcel(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  const data = [];
  const errors = [];

  if (!worksheet) {
    return { valid: false, data, weeks: [], errors: [{ row: 0, message: 'Workbook does not contain a worksheet' }] };
  }

  const header = findHeader(worksheet);
  if (!header) {
    return { valid: false, data, weeks: [], errors: [{ row: 0, message: 'Could not find Name and Position columns' }] };
  }

  const dateRowNumber = findDateRow(worksheet, header.rowNumber, header.department + 1);
  const weeks = buildWeekDefinitions(worksheet, header, dateRowNumber).map((week, index) => ({
    ...week,
    week_key: week.week_key || `uploaded-week-${index + 1}`,
    week_start: week.week_start || week.week_key || `uploaded-week-${index + 1}`,
    rows: []
  }));

  let sectionIndex = 0;
  const startRow = Math.max(header.rowNumber, dateRowNumber) + 1;

  for (let rowNumber = startRow; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);

    if (isSeparatorRow(row, worksheet.columnCount)) {
      sectionIndex = Math.min(sectionIndex + 1, BASE_SHIFT_BY_SECTION.length - 1);
      continue;
    }

    const name = safeCellText(row.getCell(header.name));
    const department = safeCellText(row.getCell(header.department));
    const employeeId = normaliseEmployeeId(header.employeeId ? safeCellText(row.getCell(header.employeeId)) : '');

    if (!name && !department) continue;
    if (!name) {
      errors.push({ row: rowNumber, message: 'Missing Employee Name' });
      continue;
    }

    const baseShift = BASE_SHIFT_BY_SECTION[sectionIndex] || 'Morning';

    weeks.forEach((week) => {
      const shifts = {};
      week.columns.forEach(({ column, day }) => {
        shifts[day] = normaliseShift(safeCellText(row.getCell(column)), baseShift);
      });

      week.rows.push({
        employeeId,
        name,
        department: department || 'Unassigned',
        shiftGroup: baseShift,
        shifts
      });
    });
  }

  const flatData = flattenWeeks(weeks);

  return {
    valid: errors.length === 0,
    data: flatData,
    weeks: weeks.map((week) => ({
      week_key: week.week_key,
      week_start: week.week_start,
      columns: week.columns,
      rows: week.rows
    })),
    errors
  };
}

module.exports = {
  parseScheduleExcel,
  DAY_KEYS
};
