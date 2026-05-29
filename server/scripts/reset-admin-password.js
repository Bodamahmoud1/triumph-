require('dotenv').config();

const { createClient } = require('@libsql/client');
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

const dbUrl = process.env.TURSO_DATABASE_URL || 'file:./triumph_laundry.db';
const dbAuthToken = process.env.TURSO_AUTH_TOKEN || '';

const db = createClient({
  url: dbUrl,
  authToken: dbAuthToken
});

async function main() {
  const adminResult = await db.execute({
    sql: 'SELECT id, username FROM admins WHERE username = ?',
    args: [username]
  });
  const admin = adminResult.rows[0];

  if (!admin) {
    fail(`Admin user "${username}" not found in database.`);
  }

  const salt = bcrypt.genSaltSync(12);
  const hash = bcrypt.hashSync(String(newPassword), salt);

  await db.execute({
    sql: 'UPDATE admins SET password_hash = ? WHERE id = ?',
    args: [hash, admin.id]
  });
  await db.execute({
    sql: 'UPDATE sessions SET is_revoked = 1 WHERE admin_id = ?',
    args: [admin.id]
  });
  await db.execute({
    sql: 'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
    args: [admin.id, 'Password Reset (CLI)', JSON.stringify({ username: admin.username })]
  });

  console.log(`OK: Password reset for admin "${admin.username}". All sessions revoked.`);
  console.log(`Database: ${dbUrl.startsWith('file:') ? dbUrl : '(Turso remote)'}`);
}

main().catch((err) => {
  console.error('Password reset failed:', err.message || err);
  process.exit(1);
});
