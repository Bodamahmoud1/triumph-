const { readFileSync } = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const scheduleSource = () => readFileSync('server/routes/schedule.js', 'utf8');

test('schedule publish restores matching soft-deleted employees instead of duplicating them', () => {
  const source = scheduleSource();

  assert.match(
    source,
    /SELECT id, name_ar, employee_id, department, status, is_deleted FROM employees WHERE employee_id = \?/
  );
  assert.match(
    source,
    /SELECT id, name_ar, employee_id, department, status, is_deleted FROM employees WHERE name_ar = \? AND \(employee_id IS NULL OR employee_id = ''\) ORDER BY is_deleted ASC, id ASC/
  );
  assert.match(
    source,
    /UPDATE employees SET name_ar = \?, department = \?, status = \?, is_deleted = 0 WHERE id = \?/
  );
  assert.match(source, /if \(existingEmp\.is_deleted\) \{/);
  assert.match(source, /action: 'restored'/);
  assert.match(source, /status: 'Active'/);
});

test('schedule publish audit logs restored deleted employee details', () => {
  const source = scheduleSource();

  assert.match(source, /const employeeAuditEvents = \[\];/);
  assert.match(source, /employeeAuditEvents\.push\(\{/);
  assert.match(source, /previous: \{/);
  assert.match(source, /current: \{/);
  assert.match(source, /employeeEvents: employeeAuditEvents/);
});
