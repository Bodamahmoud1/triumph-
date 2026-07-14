const { readFileSync } = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

test('public schedules are fresh, omit employee IDs, and remain available in navigation', () => {
  const routeSource = readFileSync('server/routes/schedule.js', 'utf8');
  const clientSource = readFileSync('js/schedule.js', 'utf8');
  const componentStyles = readFileSync('css/components.css', 'utf8');

  assert.match(routeSource, /res\.set\('Cache-Control', 'no-store'\)/);
  assert.equal(/employee_id:\s*row\.employee_id/.test(routeSource), false);
  assert.match(clientSource, /fetch\(url, \{ cache: 'no-store' \}\)/);
  assert.match(clientSource, /getScheduleCacheKey/);
  assert.match(componentStyles, /\.bnav-item\[data-section="schedule"\]/);
});
