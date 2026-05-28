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

async function runMigrations(db) {
  await db.execute(`
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
  
<<<<<<< HEAD
  for (const file of files) {
    const isMigrated = await db.execute({ sql: 'SELECT id FROM migrations WHERE name = ?', args: [file] });
    if (isMigrated.rows.length === 0) {
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      try {
        await db.executeMultiple(sql);
        await db.execute({ sql: 'INSERT INTO migrations (name) VALUES (?)', args: [file] });
      } catch (err) {
        console.error(`Migration ${file} failed:`, err);
        throw err;
=======
  for (const migration of migrations) {
    const existing = db.prepare('SELECT id, checksum FROM migrations WHERE name = ?').get(migration.file);
    if (existing) {
      if (existing.checksum && existing.checksum !== migration.checksum) {
        throw new Error(`Migration ${migration.file} has changed since it was applied. Create a new migration instead of editing old migrations.`);
>>>>>>> c9251826d2e634acb03ab8b0655b798f714a4149
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
