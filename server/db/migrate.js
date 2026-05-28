const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function getTableColumns(db, tableName) {
  return new Set(db.prepare(`PRAGMA table_info(${tableName})`).all().map(column => column.name));
}

function addColumnIfMissing(db, tableName, columnName, definition) {
  const columns = getTableColumns(db, tableName);
  if (!columns.has(columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function getMigrationChecksums(files, migrationsDir) {
  return files.map((file) => {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    return {
      file,
      sql,
      checksum: crypto.createHash('sha256').update(sql).digest('hex')
    };
  });
}

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      checksum TEXT,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  addColumnIfMissing(db, 'migrations', 'checksum', 'TEXT');

  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Tracked migrations directory is missing: ${migrationsDir}`);
  }

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  const migrations = getMigrationChecksums(files, migrationsDir);
  
  for (const migration of migrations) {
    const existing = db.prepare('SELECT id, checksum FROM migrations WHERE name = ?').get(migration.file);
    if (existing) {
      if (existing.checksum && existing.checksum !== migration.checksum) {
        throw new Error(`Migration ${migration.file} has changed since it was applied. Create a new migration instead of editing old migrations.`);
      }
      if (!existing.checksum) {
        db.prepare('UPDATE migrations SET checksum = ? WHERE id = ?').run(migration.checksum, existing.id);
      }
      continue;
    }

    console.log(`Running migration: ${migration.file}`);
    try {
      db.exec(migration.sql);
      db.prepare('INSERT INTO migrations (name, checksum) VALUES (?, ?)').run(migration.file, migration.checksum);
    } catch (err) {
      console.error(`Migration ${migration.file} failed:`, err);
      throw err;
    }
  }
}

module.exports = runMigrations;
