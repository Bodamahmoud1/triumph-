const path = require('path');

function normalizePathForCheck(value) {
  return path.resolve(value).replace(/\\/g, '/');
}

function isTmpPath(value) {
  const raw = String(value || '').replace(/\\/g, '/');
  if (raw === '/tmp' || raw.startsWith('/tmp/')) return true;
  const normalized = normalizePathForCheck(raw);
  return normalized === '/tmp' || normalized.startsWith('/tmp/');
}

function isAbsoluteDbPath(value) {
  return path.isAbsolute(value) || path.win32.isAbsolute(value);
}

function resolveDatabasePath(env = process.env) {
  const dbPath = (env.DB_PATH || '').trim();

  if (dbPath) {
    if (env.NODE_ENV === 'production' && !isAbsoluteDbPath(dbPath)) {
      throw new Error('DB_PATH must be an absolute persistent filesystem path in production; configure a path such as /app/data/triumph.db.');
    }
    if (env.NODE_ENV === 'production' && isTmpPath(dbPath)) {
      throw new Error('DB_PATH must not point to /tmp in production; configure a persistent volume path such as /app/data/triumph.db.');
    }
    return dbPath;
  }

  if (env.NODE_ENV === 'production') {
    const databaseUrl = (env.DATABASE_URL || '').trim();
    const managedDatabaseNote = databaseUrl
      ? ' DATABASE_URL is set, but this SQLite server does not include a managed database adapter; deploy with a persistent DB_PATH or add an adapter before enabling managed database URLs.'
      : ' Managed database URLs require adding a supported adapter before use.';

    throw new Error(`DB_PATH must be set to an explicit persistent SQLite path in production.${managedDatabaseNote}`);
  }

  return './triumph_laundry.db';
}

module.exports = {
  isAbsoluteDbPath,
  isTmpPath,
  resolveDatabasePath
};
