const { execFileSync } = require('child_process');
const { readFileSync, existsSync } = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

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
