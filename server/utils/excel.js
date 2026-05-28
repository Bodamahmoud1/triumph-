const ExcelJS = require('exceljs');

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
  
  const worksheet = workbook.worksheets[0]; // Assuming first sheet
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
    
    if (rowErrors.length > 0) {
      errors.push({ row: rowNumber, name: name || 'Unknown', issues: rowErrors });
    } else if (name) {
      data.push({
        name,
        job,
        department: job,
        shifts
      });
    }
  });
  
  return {
    valid: errors.length === 0,
    data,
    errors
  };
}

module.exports = {
  parseScheduleExcel
};
