const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const authenticateToken = require('../middleware/auth');

// POST /api/admin/login
router.post('/', [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').trim().notEmpty().withMessage('Password is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { username, password } = req.body;
  const db = req.app.locals.db;

  try {
    const adminResult = await db.execute({ sql: 'SELECT * FROM admins WHERE username = ?', args: [username] });
    const admin = adminResult.rows[0];
    
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

    await db.execute({
      sql: 'INSERT INTO sessions (admin_id, refresh_token, expires_at) VALUES (?, ?, ?)',
      args: [admin.id, refreshToken, expiresAt.toISOString()]
    });

    // Log audit
    await db.execute({
      sql: 'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
      args: [admin.id, 'Login', JSON.stringify({ ip: req.ip })]
    });

    res.json({ token, refreshToken });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/refresh
router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { refreshToken } = req.body;
  const db = req.app.locals.db;

  try {
    const sessionResult = await db.execute({
      sql: 'SELECT * FROM sessions WHERE refresh_token = ? AND is_revoked = 0 AND expires_at > CURRENT_TIMESTAMP',
      args: [refreshToken]
    });
    const session = sessionResult.rows[0];

    if (!session) {
      return res.status(403).json({ error: 'Invalid or expired refresh token' });
    }

    const adminResult = await db.execute({ sql: 'SELECT * FROM admins WHERE id = ?', args: [session.admin_id] });
    const admin = adminResult.rows[0];
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

    await db.execute({
      sql: 'UPDATE sessions SET refresh_token = ?, expires_at = ? WHERE id = ?',
      args: [newRefreshToken, expiresAt.toISOString(), session.id]
    });

    res.json({ token, refreshToken: newRefreshToken });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/change-password
router.post('/change-password', authenticateToken, [
  body('oldPassword').notEmpty().withMessage('Old password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters long')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { oldPassword, newPassword } = req.body;
  const db = req.app.locals.db;
  const adminId = req.user.id;

  try {
    const adminResult = await db.execute({ sql: 'SELECT * FROM admins WHERE id = ?', args: [adminId] });
    const admin = adminResult.rows[0];
    
    if (!admin || !bcrypt.compareSync(oldPassword, admin.password_hash)) {
      return res.status(401).json({ error: 'كلمة المرور القديمة غير صحيحة' });
    }

    const salt = bcrypt.genSaltSync(12);
    const hash = bcrypt.hashSync(newPassword, salt);

    await db.execute({ sql: 'UPDATE admins SET password_hash = ? WHERE id = ?', args: [hash, adminId] });
    
    // Revoke all existing sessions for security
    await db.execute({ sql: 'UPDATE sessions SET is_revoked = 1 WHERE admin_id = ?', args: [adminId] });

    await db.execute({
      sql: 'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
      args: [adminId, 'Password Change', JSON.stringify({ ip: req.ip })]
    });

    res.json({ message: 'تم تغيير كلمة المرور بنجاح. يرجى تسجيل الدخول مرة أخرى.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/logout
router.post('/logout', authenticateToken, [
  body('refreshToken').notEmpty().withMessage('Refresh token required')
], async (req, res) => {
  const { refreshToken } = req.body;
  const db = req.app.locals.db;
  
  try {
    await db.execute({ sql: 'UPDATE sessions SET is_revoked = 1 WHERE refresh_token = ?', args: [refreshToken] });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
