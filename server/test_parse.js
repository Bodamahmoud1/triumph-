const path = require('path');
const { parseScheduleExcel } = require('./utils/excel');

async function test() {
  try {
    const res = await parseScheduleExcel(path.join(__dirname, '..', 'test_schedule.xlsx'));
    console.log(JSON.stringify(res, null, 2));
  } catch(e) {
    console.error(e);
  }
}
test();
