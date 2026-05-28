const ExcelJS = require('exceljs');

/**
 * Parses the uploaded Schedule Excel file (14-days format)
 */
async function parseScheduleExcel(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
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
    errors
  };
}

module.exports = {
  parseScheduleExcel
};
