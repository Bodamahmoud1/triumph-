const fs = require('fs');
const path = require('path');

function getTableColumns(db, tableName) {
  return new Set(db.prepare(`PRAGMA table_info(${tableName})`).all().map(column => column.name));
}

function addColumnIfMissing(db, tableName, columnName, definition) {
  const columns = getTableColumns(db, tableName);
  if (!columns.has(columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function ensureCompatibilitySchema(db) {
  addColumnIfMissing(db, 'employees', 'status', "TEXT DEFAULT 'Active'");
  addColumnIfMissing(db, 'employees', 'is_deleted', 'BOOLEAN DEFAULT 0');
}

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir);
    // Copy schema.sql to 001_initial.sql if it exists
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      fs.copyFileSync(schemaPath, path.join(migrationsDir, '001_initial.sql'));
    }
  }

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  
  for (const file of files) {
    const isMigrated = db.prepare('SELECT id FROM migrations WHERE name = ?').get(file);
    if (!isMigrated) {
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      try {
        db.exec(sql);
        db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
      } catch (err) {
        console.error(`Migration ${file} failed:`, err);
        throw err;
      }
    }
  }

  ensureCompatibilitySchema(db);
}

module.exports = runMigrations;
