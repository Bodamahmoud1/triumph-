require('dotenv').config();

const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

function fail(message) {
  console.error(message);
  process.exit(1);
}

const username = process.env.ADMIN_USERNAME || 'admin';
const newPassword = process.env.ADMIN_PASSWORD;

if (!newPassword || String(newPassword).trim().length < 8) {
  fail('ADMIN_PASSWORD must be set and at least 8 characters long (in server/.env).');
}

const dbPath = process.env.DB_PATH
  ? path.resolve(__dirname, '..', process.env.DB_PATH)
  : path.resolve(__dirname, '..', 'triumph_laundry.db');

const db = new Database(dbPath);

try {
  const admin = db.prepare('SELECT id, username FROM admins WHERE username = ?').get(username);
  if (!admin) {
    fail(`Admin user "${username}" not found in DB. (DB_PATH=${dbPath})`);
  }

  const salt = bcrypt.genSaltSync(12);
  const hash = bcrypt.hashSync(String(newPassword), salt);

  const tx = db.transaction(() => {
    db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, admin.id);
    db.prepare('UPDATE sessions SET is_revoked = 1 WHERE admin_id = ?').run(admin.id);
    db.prepare('INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)').run(
      admin.id,
      'Password Reset (CLI)',
      JSON.stringify({ username: admin.username })
    );
  });

  tx();
  console.log(`OK: Password reset for admin "${admin.username}". All sessions revoked.`);
} finally {
  db.close();
}

