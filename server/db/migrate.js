const fs = require('fs');
const path = require('path');

async function runMigrations(db) {
  await db.execute(`
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
    const isMigrated = await db.execute({ sql: 'SELECT id FROM migrations WHERE name = ?', args: [file] });
    if (isMigrated.rows.length === 0) {
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      try {
        await db.executeMultiple(sql);
        await db.execute({ sql: 'INSERT INTO migrations (name) VALUES (?)', args: [file] });
      } catch (err) {
        const msg = String(err.message || err);
        if (/duplicate column/i.test(msg)) {
          console.warn(`Migration ${file} skipped (column already exists)`);
          await db.execute({ sql: 'INSERT INTO migrations (name) VALUES (?)', args: [file] });
          continue;
        }
        console.error(`Migration ${file} failed:`, err);
        throw err;
      }
    }
  }
}

module.exports = runMigrations;
