#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@libsql/client');
const runMigrations = require('../db/migrate');
const { resolveDatabasePath } = require('../db/config');

async function main() {
  const dbPath = resolveDatabasePath(process.env);
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL || `file:${dbPath}`,
    authToken: process.env.TURSO_AUTH_TOKEN || ''
  });
  await runMigrations(db);
  console.log(`Migrations applied successfully to ${dbPath}`);
}

main().catch((error) => {
  console.error('Migration failed:', error.message || error);
  process.exitCode = 1;
});
