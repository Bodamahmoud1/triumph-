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
 * Parses the uploaded Schedule Excel file
 * Expected Format:
 * Col 1: Employee Name
 * Col 2: Job
 * Col 3-9: Saturday through Friday
 */
async function parseScheduleExcel(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  const data = [];
  const errors = [];
  
  const validShifts = ['Morning', 'Evening', 'Night', 'Off', 'Holiday'];
  
  // Assuming row 1 is header, start at row 2
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header
    
    // Get values
    const name = row.getCell(1).text?.trim();
    const job = row.getCell(2).text?.trim();
    const sat = row.getCell(3).text?.trim() || 'Off';
    const sun = row.getCell(4).text?.trim() || 'Off';
    const mon = row.getCell(5).text?.trim() || 'Off';
    const tue = row.getCell(6).text?.trim() || 'Off';
    const wed = row.getCell(7).text?.trim() || 'Off';
    const thu = row.getCell(8).text?.trim() || 'Off';
    const fri = row.getCell(9).text?.trim() || 'Off';
    
    // Validation
    const rowErrors = [];
    if (!name) rowErrors.push('Missing Employee Name');
    if (!job) rowErrors.push('Missing Job');
    
    const shifts = { Saturday: sat, Sunday: sun, Monday: mon, Tuesday: tue, Wednesday: wed, Thursday: thu, Friday: fri };
    
    for (const [day, shift] of Object.entries(shifts)) {
      // Very basic validation, allow custom text but flag if completely unknown
      // In production you might want stricter matching
      const isRecognized = validShifts.some(vs => shift.toLowerCase().includes(vs.toLowerCase())) || shift === '';
      if (!isRecognized && shift !== '') {
         // Maybe just a warning, but we accept it for now or strictly enforce:
         // rowErrors.push(`Invalid shift "${shift}" on ${day}`);
      }
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
        job,
        department: job,
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
