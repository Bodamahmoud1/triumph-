const { parseScheduleExcel } = require('./server/utils/excel');
const path = require('path');

async function test() {
  try {
    const res = await parseScheduleExcel('B:\\Downloads\\clax\\New Microsoft Excel Worksheet (2).xlsx');
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error("ERROR CAUGHT:");
    console.error(e);
  }
}

test();
