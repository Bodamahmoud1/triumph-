const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveDatabasePath, isAbsoluteDbPath, isTmpPath } = require('../server/db/config');

test('uses local SQLite path by default outside production', () => {
  assert.equal(resolveDatabasePath({ NODE_ENV: 'development' }), './triumph_laundry.db');
  assert.equal(resolveDatabasePath({ VERCEL: '1' }), './triumph_laundry.db');
});

test('uses explicit DB_PATH in production when it is persistent', () => {
  assert.equal(
    resolveDatabasePath({ NODE_ENV: 'production', DB_PATH: '/app/data/triumph.db' }),
    '/app/data/triumph.db'
  );
});

test('requires production DB_PATH to be absolute', () => {
  assert.equal(isAbsoluteDbPath('/app/data/triumph.db'), true);
  assert.equal(isAbsoluteDbPath('./triumph_laundry.db'), false);
  assert.throws(
    () => resolveDatabasePath({ NODE_ENV: 'production', DB_PATH: './triumph_laundry.db' }),
    /DB_PATH must be an absolute persistent filesystem path in production/
  );
});

test('requires explicit DB_PATH in production', () => {
  assert.throws(
    () => resolveDatabasePath({ NODE_ENV: 'production' }),
    /DB_PATH must be set to an explicit persistent SQLite path in production/
  );
});

test('fails in production when DB_PATH points to /tmp', () => {
  assert.equal(isTmpPath('/tmp/triumph_laundry.db'), true);
  assert.equal(isTmpPath('/var/tmp/triumph_laundry.db'), false);
  assert.throws(
    () => resolveDatabasePath({ NODE_ENV: 'production', DB_PATH: '/tmp/triumph_laundry.db' }),
    /DB_PATH must not point to \/tmp in production/
  );
});

test('does not silently accept DATABASE_URL without a managed database adapter', () => {
  assert.throws(
    () => resolveDatabasePath({ NODE_ENV: 'production', DATABASE_URL: 'postgres://example.invalid/db' }),
    /DATABASE_URL is set, but this SQLite server does not include a managed database adapter/
  );
});
