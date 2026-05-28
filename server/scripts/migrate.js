#!/usr/bin/env node
require('dotenv').config();
const Database = require('better-sqlite3');
const runMigrations = require('../db/migrate');
const { resolveDatabasePath } = require('../db/config');

const dbPath = resolveDatabasePath(process.env);
const db = new Database(dbPath);
try {
  runMigrations(db);
  console.log(`Migrations applied successfully to ${dbPath}`);
} finally {
  db.close();
}
