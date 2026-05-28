const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const authenticateToken = require('../middleware/auth');

const REFRESH_COOKIE_NAME = 'triumph_admin_refresh';
const REFRESH_TOKEN_DAYS = 7;

function hashRefreshToken(refreshToken) {
  return crypto.createHash('sha256').update(String(refreshToken)).digest('hex');
}

function createAccessToken(admin) {
  return jwt.sign(
    { id: admin.id, username: admin.username },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function createRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

function getRefreshExpiry() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);
  return expiresAt;
}

function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || null;
}

function getUserAgent(req) {
  return String(req.headers['user-agent'] || '').slice(0, 500) || null;
}

function setRefreshCookie(res, refreshToken, expiresAt) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires: expiresAt,
    path: '/api/admin/login'
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/admin/login'
  });
}

function readRefreshToken(req) {
  if (req.body && req.body.refreshToken) return req.body.refreshToken;
  const cookieHeader = String(req.headers.cookie || '');
  const cookie = cookieHeader
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${REFRESH_COOKIE_NAME}=`));
  return cookie ? decodeURIComponent(cookie.slice(REFRESH_COOKIE_NAME.length + 1)) : '';
}

function revokeSessionFamily(db, session, reason) {
  if (session.token_family) {
    db.prepare('UPDATE sessions SET is_revoked = 1, revoked_reason = ? WHERE token_family = ?')
      .run(reason, session.token_family);
  } else {
    db.prepare('UPDATE sessions SET is_revoked = 1, revoked_reason = ? WHERE id = ?')
      .run(reason, session.id);
  }
}

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

<<<<<<< HEAD
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
=======
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
  }

  const token = createAccessToken(admin);
  const refreshToken = createRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const tokenFamily = crypto.randomUUID();
  const expiresAt = getRefreshExpiry();

  db.prepare(`
    INSERT INTO sessions (admin_id, refresh_token, token_family, expires_at, user_agent, ip_address, last_used_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(admin.id, refreshTokenHash, tokenFamily, expiresAt.toISOString(), getUserAgent(req), getClientIp(req));

  db.prepare('INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)')
    .run(admin.id, 'Login', JSON.stringify({ ip: getClientIp(req), userAgent: getUserAgent(req) }));

  setRefreshCookie(res, refreshToken, expiresAt);
  res.json({ token, refreshToken });
});

// POST /api/admin/refresh
router.post('/refresh', (req, res) => {
  const refreshToken = readRefreshToken(req);
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
>>>>>>> c9251826d2e634acb03ab8b0655b798f714a4149
  }

  const db = req.app.locals.db;
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const anySession = db.prepare('SELECT * FROM sessions WHERE refresh_token = ?').get(refreshTokenHash);

<<<<<<< HEAD
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
=======
  if (anySession && anySession.is_revoked) {
    revokeSessionFamily(db, anySession, 'refresh_token_reuse_detected');
    clearRefreshCookie(res);
    return res.status(403).json({ error: 'Refresh token reuse detected; session family revoked' });
  }

  const session = db.prepare('SELECT * FROM sessions WHERE refresh_token = ? AND is_revoked = 0 AND expires_at > CURRENT_TIMESTAMP').get(refreshTokenHash);
  if (!session) {
    clearRefreshCookie(res);
    return res.status(403).json({ error: 'Invalid or expired refresh token' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(session.admin_id);
  if (!admin) {
    clearRefreshCookie(res);
    return res.status(403).json({ error: 'Invalid user' });
  }

  const token = createAccessToken(admin);
  const newRefreshToken = createRefreshToken();
  const newRefreshTokenHash = hashRefreshToken(newRefreshToken);
  const expiresAt = getRefreshExpiry();

  const rotate = db.transaction(() => {
    const newSession = db.prepare(`
      INSERT INTO sessions (admin_id, refresh_token, token_family, expires_at, user_agent, ip_address, last_used_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(admin.id, newRefreshTokenHash, session.token_family || crypto.randomUUID(), expiresAt.toISOString(), getUserAgent(req), getClientIp(req));

    db.prepare(`
      UPDATE sessions
      SET is_revoked = 1,
          revoked_reason = 'rotated',
          replaced_by = ?,
          last_used_at = CURRENT_TIMESTAMP,
          user_agent = COALESCE(user_agent, ?),
          ip_address = COALESCE(ip_address, ?)
      WHERE id = ?
    `).run(newSession.lastInsertRowid, getUserAgent(req), getClientIp(req), session.id);
  });

  rotate();
  setRefreshCookie(res, newRefreshToken, expiresAt);
  res.json({ token, refreshToken: newRefreshToken });
>>>>>>> c9251826d2e634acb03ab8b0655b798f714a4149
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
<<<<<<< HEAD
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
=======

  const salt = bcrypt.genSaltSync(12);
  const hash = bcrypt.hashSync(newPassword, salt);

  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, adminId);
  db.prepare("UPDATE sessions SET is_revoked = 1, revoked_reason = 'password_changed' WHERE admin_id = ?").run(adminId);

  db.prepare('INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)')
    .run(adminId, 'Password Change', JSON.stringify({ ip: getClientIp(req), userAgent: getUserAgent(req) }));

  clearRefreshCookie(res);
  res.json({ message: 'تم تغيير كلمة المرور بنجاح. يرجى تسجيل الدخول مرة أخرى.' });
});

// POST /api/admin/logout
router.post('/logout', authenticateToken, (req, res) => {
  const refreshToken = readRefreshToken(req);
  const db = req.app.locals.db;
  
  if (refreshToken) {
    db.prepare("UPDATE sessions SET is_revoked = 1, revoked_reason = 'logout' WHERE refresh_token = ?")
      .run(hashRefreshToken(refreshToken));
  }

  clearRefreshCookie(res);
  res.json({ message: 'Logged out successfully' });
>>>>>>> c9251826d2e634acb03ab8b0655b798f714a4149
});

module.exports = router;
module.exports._private = {
  REFRESH_COOKIE_NAME,
  hashRefreshToken,
  readRefreshToken,
  setRefreshCookie
};
