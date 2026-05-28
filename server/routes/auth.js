const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const authenticateToken = require('../middleware/auth');

function hashRefreshToken(refreshToken) {
  return crypto.createHash('sha256').update(String(refreshToken)).digest('hex');
}

// POST /api/admin/login
router.post('/', [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').trim().notEmpty().withMessage('Password is required')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { username, password } = req.body;
  const db = req.app.locals.db;

  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' }); // Invalid credentials
  }

  // Generate tokens
  const token = jwt.sign(
    { id: admin.id, username: admin.username },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const refreshToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  db.prepare('INSERT INTO sessions (admin_id, refresh_token, expires_at) VALUES (?, ?, ?)')
    .run(admin.id, hashRefreshToken(refreshToken), expiresAt.toISOString());

  // Log audit
  db.prepare('INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)')
    .run(admin.id, 'Login', JSON.stringify({ ip: req.ip }));

  res.json({ token, refreshToken });
});

// POST /api/admin/refresh
router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token required')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { refreshToken } = req.body;
  const db = req.app.locals.db;

  const refreshTokenHash = hashRefreshToken(refreshToken);

  const session = db.prepare('SELECT * FROM sessions WHERE refresh_token = ? AND is_revoked = 0 AND expires_at > CURRENT_TIMESTAMP').get(refreshTokenHash);

  if (!session) {
    return res.status(403).json({ error: 'Invalid or expired refresh token' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(session.admin_id);
  if (!admin) {
    return res.status(403).json({ error: 'Invalid user' });
  }

  // Generate new tokens
  const token = jwt.sign(
    { id: admin.id, username: admin.username },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const newRefreshToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const stmt = db.prepare('UPDATE sessions SET refresh_token = ?, expires_at = ? WHERE id = ?');
  stmt.run(hashRefreshToken(newRefreshToken), expiresAt.toISOString(), session.id);

  res.json({ token, refreshToken: newRefreshToken });
});

// POST /api/admin/change-password
router.post('/change-password', authenticateToken, [
  body('oldPassword').notEmpty().withMessage('Old password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters long')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { oldPassword, newPassword } = req.body;
  const db = req.app.locals.db;
  const adminId = req.user.id;

  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(adminId);
  
  if (!admin || !bcrypt.compareSync(oldPassword, admin.password_hash)) {
    return res.status(401).json({ error: 'كلمة المرور القديمة غير صحيحة' });
  }

  const salt = bcrypt.genSaltSync(12);
  const hash = bcrypt.hashSync(newPassword, salt);

  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, adminId);
  
  // Revoke all existing sessions for security
  db.prepare('UPDATE sessions SET is_revoked = 1 WHERE admin_id = ?').run(adminId);

  db.prepare('INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)')
    .run(adminId, 'Password Change', JSON.stringify({ ip: req.ip }));

  res.json({ message: 'تم تغيير كلمة المرور بنجاح. يرجى تسجيل الدخول مرة أخرى.' });
});

// POST /api/admin/logout
router.post('/logout', authenticateToken, [
  body('refreshToken').notEmpty().withMessage('Refresh token required')
], (req, res) => {
  const { refreshToken } = req.body;
  const db = req.app.locals.db;
  
  db.prepare('UPDATE sessions SET is_revoked = 1 WHERE refresh_token = ?').run(hashRefreshToken(refreshToken));
  
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
