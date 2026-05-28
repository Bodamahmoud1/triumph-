const { execFileSync } = require('child_process');
const { readFileSync, existsSync } = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

function getOptionalBetterSqlite3() {
  try {
    return require('better-sqlite3');
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') return null;
    throw error;
  }
}

test('service worker precache assets exist locally', () => {
  const source = readFileSync('sw.js', 'utf8');
  const sandbox = {
    self: {
      addEventListener() {},
      skipWaiting() {},
      clients: { claim() {} }
    },
    caches: { open() {}, keys() {} },
    fetch() {},
    URL,
    Response
  };
  vm.runInNewContext(`${source}\nthis.__APP_SHELL__ = APP_SHELL;`, sandbox, { filename: 'sw.js' });
  const localAssets = sandbox.__APP_SHELL__.filter((asset) => asset.startsWith('./'));
  const missing = localAssets
    .map((asset) => asset.replace(/^\.\//, ''))
    .filter((asset) => asset !== '' && !existsSync(asset));

  assert.equal(missing.length, 0, `Missing service worker assets: ${missing.join(', ')}`);
});

test('CSP removes unsafe-eval and adds hardening directives', () => {
  const source = readFileSync('server/index.js', 'utf8');
  assert.equal(source.includes("'unsafe-eval'"), false);
  assert.match(source, /objectSrc:\s*\["'none'"\]/);
  assert.match(source, /frameAncestors:\s*\["'self'"\]/);
});

test('CORS origins are environment-configurable', () => {
  const source = readFileSync('server/index.js', 'utf8');
  assert.match(source, /process\.env\.CORS_ORIGIN/);
  assert.match(source, /split\(','\)/);
});

test('refresh tokens are hashed before persistence and lookup', () => {
  const source = readFileSync('server/routes/auth.js', 'utf8');
  assert.match(source, /function hashRefreshToken/);
  assert.match(source, /createHash\('sha256'\)/);
  assert.match(source, /\.run\(admin\.id, hashRefreshToken\(refreshToken\)/);
  assert.match(source, /get\(refreshTokenHash\)/);
});

test('runtime database and upload files are not tracked by git', () => {
  const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  const trackedRuntimeFiles = files.filter((file) => /^server\/uploads\//.test(file) || /^server\/.*\.db$/.test(file));
  assert.equal(trackedRuntimeFiles.length, 0, `Tracked runtime files: ${trackedRuntimeFiles.join(', ')}`);
});

test('catalogue data reads seed JSON into SQLite when no persisted row exists', (t) => {
  const Database = getOptionalBetterSqlite3();
  if (!Database) return t.skip('better-sqlite3 is not installed in this environment');
  const runMigrations = require('../server/db/migrate');
  const { _private: catalogue } = require('../server/routes/data-files');
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    const expected = JSON.parse(readFileSync('data/chemicals.json', 'utf8'));

    const data = catalogue.getCatalogueData(db, 'chemicals');
    const row = db.prepare('SELECT payload FROM catalogue_data WHERE kind = ?').get('chemicals');

    assert.deepEqual(data, expected);
    assert.deepEqual(JSON.parse(row.payload), expected);
  } finally {
    db.close();
  }
});

test('catalogue data updates persisted SQLite payload and writes audit details', (t) => {
  const Database = getOptionalBetterSqlite3();
  if (!Database) return t.skip('better-sqlite3 is not installed in this environment');
  const runMigrations = require('../server/db/migrate');
  const { _private: catalogue } = require('../server/routes/data-files');
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    const adminId = db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run('catalogue-admin', 'hash').lastInsertRowid;
    const replacement = [
      {
        id: 'test-chemical',
        theme: 'blue',
        name: 'Test Chemical',
        code: 'TC-1'
      }
    ];

    catalogue.replaceCatalogueData(db, 'chemicals', replacement, adminId);

    assert.deepEqual(catalogue.getCatalogueData(db, 'chemicals'), replacement);

    const audit = db.prepare('SELECT admin_id, action, details FROM audit_log ORDER BY id DESC LIMIT 1').get();
    assert.equal(audit.admin_id, adminId);
    assert.equal(audit.action, 'Update Catalogue Data');
    assert.deepEqual(JSON.parse(audit.details), {
      kind: 'chemicals',
      itemCount: 1,
      adminId
    });
  } finally {
    db.close();
  }
});
