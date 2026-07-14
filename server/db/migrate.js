const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function checksum(sql) {
  return crypto.createHash('sha256').update(sql).digest('hex');
}

async function ensureChecksumColumn(db) {
  try {
    await db.execute('ALTER TABLE migrations ADD COLUMN checksum TEXT');
  } catch (error) {
    if (!/duplicate column name/i.test(String(error.message || error))) throw error;
  }
}

async function runMigrations(db) {
  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    throw new Error('Tracked migrations directory is missing; restore server/db/migrations from source control before running migrations.');
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      checksum TEXT,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await ensureChecksumColumn(db);

  const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const fileChecksum = checksum(sql);
    const existingResult = await db.execute({ sql: 'SELECT id, checksum FROM migrations WHERE name = ?', args: [file] });
    const existing = existingResult.rows[0];

    if (existing) {
      if (existing.checksum && existing.checksum !== fileChecksum) {
        throw new Error(`Migration ${file} has changed since it was applied. Create a new migration instead of editing tracked history.`);
      }
      if (!existing.checksum) {
        await db.execute({ sql: 'UPDATE migrations SET checksum = ? WHERE id = ?', args: [fileChecksum, existing.id] });
      }
      continue;
    }

    console.log(`Running migration: ${file}`);
    await db.executeMultiple(sql);
    await db.execute({ sql: 'INSERT INTO migrations (name, checksum) VALUES (?, ?)', args: [file, fileChecksum] });
  }
}

module.exports = runMigrations;
module.exports.checksum = checksum;
