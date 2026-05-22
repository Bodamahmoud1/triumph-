const ExcelJS = require('exceljs');
const path = require('path');

async function createTestExcel() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Schedule');

  // Add Headers
  worksheet.addRow(['Employee Name', 'Department', 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);

  // Add Test Data
  worksheet.addRow(['Ahmed Ali', 'Washing', 'Morning', 'Morning', 'Morning', 'Morning', 'Morning', 'Off', 'Off']);
  worksheet.addRow(['Mohammed Hassan', 'Ironing', 'Evening', 'Evening', 'Evening', 'Evening', 'Evening', 'Off', 'Off']);
  worksheet.addRow(['Sara Mahmoud', 'Delivery', 'Night', 'Night', 'Night', 'Night', 'Night', 'Off', 'Off']);
  worksheet.addRow(['Omar Khaled', 'Washing', 'Off', 'Morning', 'Morning', 'Morning', 'Morning', 'Morning', 'Off']);
  worksheet.addRow(['Nour Youssef', 'Ironing', 'Holiday', 'Holiday', 'Morning', 'Morning', 'Morning', 'Morning', 'Morning']);

  // Adjust column widths for better readability
  worksheet.columns.forEach(column => {
    column.width = 15;
  });

  const filePath = path.join(__dirname, '..', 'test_schedule.xlsx');
  await workbook.xlsx.writeFile(filePath);
  console.log(`Test Excel file created successfully at: ${filePath}`);
}

createTestExcel();
