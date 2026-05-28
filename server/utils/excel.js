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
<<<<<<< HEAD
 * Parses the uploaded Schedule Excel file (14-days format)
=======
 * Parses a Triumph schedule workbook.
 *
 * Supported upload format:
 * - Employee ID, Name and Position columns.
 * - Two consecutive Saturday-Friday week blocks.
 * - Red total rows split the staff list into Morning, Evening/After and Night sections.
 * - Day cells use V = vacation, H = holiday, O = day off; an empty cell means the employee works
 *   the shift implied by the section where their name appears.
>>>>>>> c9251826d2e634acb03ab8b0655b798f714a4149
 */
async function parseScheduleExcel(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
<<<<<<< HEAD
  
  const worksheet = workbook.worksheets[0];
  const errors = [];
  
  let week1_start = new Date().toISOString().split('T')[0];
  let week2_start = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  let currentShift = 'Morning'; // Morning -> Evening -> Night
  
  const week1_data = [];
  const week2_data = [];
  
  const parseCell = (cellValue) => {
    if (!cellValue) return currentShift;
    const val = cellValue.toString().trim().toUpperCase();
    if (val === 'V') return 'Vacation';
    if (val === 'H') return 'Holiday';
    if (val === 'O') return 'Off';
    if (val === 'N') return 'Night';
    if (val === 'A') return 'Evening'; // Afternoon
    if (val === 'M') return 'Morning';
    return currentShift; // fallback
  };
  
  // Extract the dates from row 6
  const dateRow = worksheet.getRow(6);
  if (dateRow.getCell(6).value) {
    let d1 = dateRow.getCell(6).value;
    week1_start = (d1 instanceof Date) ? d1.toISOString().split('T')[0] : d1.toString().trim();
  }
  if (dateRow.getCell(13).value) {
    let d2 = dateRow.getCell(13).value;
    week2_start = (d2 instanceof Date) ? d2.toISOString().split('T')[0] : d2.toString().trim();
  }
  
  const getSafeText = (cell) => {
    if (!cell) return '';
    try {
      if (cell.text) return cell.text.toString().trim();
    } catch (e) {
      // exceljs crashes on cell.text for some merged cells
    }
    if (cell.value === null || cell.value === undefined) return '';
    if (typeof cell.value === 'object') {
      if (cell.value.richText) return cell.value.richText.map(t => t.text).join('').trim();
      if (cell.value.result !== undefined) return String(cell.value.result).trim();
      return '';
    }
    return String(cell.value).trim();
  };

  // Start reading from row 7
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber < 7) return; 
    
    const name = getSafeText(row.getCell(4));
    const dept = getSafeText(row.getCell(5));
    
    // Check if this is a separator row (no name, but contains totals/formulas in the days columns)
    const col6Val = row.getCell(6).value;
    const isSeparator = !name && col6Val !== null && col6Val !== '';
    
    if (isSeparator || name === 'Name') {
      // It's a separator. Move to next shift.
      if (currentShift === 'Morning') {
        currentShift = 'Evening';
      } else if (currentShift === 'Evening') {
        currentShift = 'Night';
      }
      return;
    }

    if (!name) return; // Skip entirely blank rows without triggering shift change
    
    // Week 1 (Cols 6-12)
    const w1_sat = parseCell(getSafeText(row.getCell(6)));
    const w1_sun = parseCell(getSafeText(row.getCell(7)));
    const w1_mon = parseCell(getSafeText(row.getCell(8)));
    const w1_tue = parseCell(getSafeText(row.getCell(9)));
    const w1_wed = parseCell(getSafeText(row.getCell(10)));
    const w1_thu = parseCell(getSafeText(row.getCell(11)));
    const w1_fri = parseCell(getSafeText(row.getCell(12)));
    
    week1_data.push({
      name,
      department: dept || 'Unknown',
      shifts: { Saturday: w1_sat, Sunday: w1_sun, Monday: w1_mon, Tuesday: w1_tue, Wednesday: w1_wed, Thursday: w1_thu, Friday: w1_fri }
    });
    
    // Week 2 (Cols 13-19)
    const w2_sat = parseCell(getSafeText(row.getCell(13)));
    const w2_sun = parseCell(getSafeText(row.getCell(14)));
    const w2_mon = parseCell(getSafeText(row.getCell(15)));
    const w2_tue = parseCell(getSafeText(row.getCell(16)));
    const w2_wed = parseCell(getSafeText(row.getCell(17)));
    const w2_thu = parseCell(getSafeText(row.getCell(18)));
    const w2_fri = parseCell(getSafeText(row.getCell(19)));
    
    week2_data.push({
      name,
      department: dept || 'Unknown',
      shifts: { Saturday: w2_sat, Sunday: w2_sun, Monday: w2_mon, Tuesday: w2_tue, Wednesday: w2_wed, Thursday: w2_thu, Friday: w2_fri }
    });
  });
  
  if (week1_data.length === 0 && week2_data.length === 0) {
    errors.push({ row: 0, name: 'File', issues: ['No employee data found. Please check file format.'] });
  }
  
  return {
    valid: errors.length === 0,
    data: [
      { week_start: week1_start, scheduleData: week1_data },
      { week_start: week2_start, scheduleData: week2_data }
    ],
=======

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
>>>>>>> c9251826d2e634acb03ab8b0655b798f714a4149
    errors
  };
}

module.exports = {
  parseScheduleExcel,
  DAY_KEYS
};
