const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const authenticateToken = require('../middleware/auth');

const REFRESH_COOKIE_NAME = 'triumph_admin_refresh';
const REFRESH_TOKEN_DAYS = 7;

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

function getRefreshTokenFromRequest(req) {
  const cookie = String(req.headers.cookie || '').split(';').map((value) => value.trim())
    .find((value) => value.startsWith(`${REFRESH_COOKIE_NAME}=`));
  return cookie ? decodeURIComponent(cookie.slice(REFRESH_COOKIE_NAME.length + 1)) : '';
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/admin/login',
    maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
  };
}

function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
}

function clearRefreshCookie(res) {
  const { maxAge, ...options } = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE_NAME, options);
}

function accessTokenFor(admin) {
  return jwt.sign({ id: admin.id, username: admin.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function sessionExpiry() {
  const value = new Date();
  value.setDate(value.getDate() + REFRESH_TOKEN_DAYS);
  return value.toISOString();
}

function requestMetadata(req) {
  return {
    userAgent: String(req.get('user-agent') || '').slice(0, 500),
    ipAddress: String(req.ip || '').slice(0, 128)
  };
}

function insertId(result) {
  return Number(result?.lastInsertRowid ?? result?.lastInsertRowId);
}

async function createSession(db, adminId, refreshTokenHash, tokenFamily, metadata) {
  return db.execute({
    sql: `
      INSERT INTO sessions (admin_id, refresh_token, expires_at, token_family, user_agent, ip_address, last_used_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `,
    args: [adminId, refreshTokenHash, sessionExpiry(), tokenFamily, metadata.userAgent, metadata.ipAddress]
  });
}

async function revokeTokenFamily(db, tokenFamily, reason) {
  if (!tokenFamily) return;
  await db.execute({
    sql: 'UPDATE sessions SET is_revoked = 1, revoked_reason = ? WHERE token_family = ? AND is_revoked = 0',
    args: [reason, tokenFamily]
  });
}

router.post('/', [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').trim().notEmpty().withMessage('Password is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const db = req.app.locals.db;
  try {
    const adminResult = await db.execute({ sql: 'SELECT * FROM admins WHERE username = ?', args: [req.body.username] });
    const admin = adminResult.rows[0];
    if (!admin || !bcrypt.compareSync(req.body.password, admin.password_hash)) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    const refreshToken = createRefreshToken();
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const metadata = requestMetadata(req);
    await createSession(db, admin.id, refreshTokenHash, crypto.randomUUID(), metadata);
    await db.execute({
      sql: 'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
      args: [admin.id, 'Login', JSON.stringify({ ip: metadata.ipAddress })]
    });
    setRefreshCookie(res, refreshToken);
    return res.json({ token: accessTokenFor(admin) });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/refresh', async (req, res) => {
  const refreshToken = getRefreshTokenFromRequest(req);
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' });

  const db = req.app.locals.db;
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const metadata = requestMetadata(req);
  try {
    const sessionResult = await db.execute({
      sql: 'SELECT * FROM sessions WHERE refresh_token = ? ORDER BY id DESC LIMIT 1',
      args: [refreshTokenHash]
    });
    const session = sessionResult.rows[0];
    if (!session) {
      clearRefreshCookie(res);
      return res.status(403).json({ error: 'Invalid or expired refresh token' });
    }
    if (session.is_revoked) {
      await revokeTokenFamily(db, session.token_family, 'refresh_token_reuse_detected');
      await db.execute({
        sql: 'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
        args: [session.admin_id, 'Refresh Token Reuse Detected', JSON.stringify({ ip: metadata.ipAddress })]
      });
      clearRefreshCookie(res);
      return res.status(403).json({ error: 'Refresh token reuse detected. Please sign in again.' });
    }
    if (new Date(session.expires_at).getTime() <= Date.now()) {
      await db.execute({
        sql: 'UPDATE sessions SET is_revoked = 1, revoked_reason = ? WHERE id = ?',
        args: ['expired', session.id]
      });
      clearRefreshCookie(res);
      return res.status(403).json({ error: 'Invalid or expired refresh token' });
    }

    const adminResult = await db.execute({ sql: 'SELECT * FROM admins WHERE id = ?', args: [session.admin_id] });
    const admin = adminResult.rows[0];
    if (!admin) {
      clearRefreshCookie(res);
      return res.status(403).json({ error: 'Invalid user' });
    }

    const newRefreshToken = createRefreshToken();
    const newRefreshTokenHash = hashRefreshToken(newRefreshToken);
    const tx = await db.transaction('write');
    try {
      const replacement = await createSession(tx, admin.id, newRefreshTokenHash, session.token_family || crypto.randomUUID(), metadata);
      await tx.execute({
        sql: "UPDATE sessions SET is_revoked = 1, revoked_reason = 'rotated', replaced_by = ?, last_used_at = CURRENT_TIMESTAMP WHERE id = ?",
        args: [insertId(replacement), session.id]
      });
      await tx.execute({
        sql: 'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
        args: [admin.id, 'Refresh Session', JSON.stringify({ ip: metadata.ipAddress })]
      });
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }

    setRefreshCookie(res, newRefreshToken);
    return res.json({ token: accessTokenFor(admin) });
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/change-password', authenticateToken, [
  body('oldPassword').notEmpty().withMessage('Old password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters long')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const db = req.app.locals.db;
  const adminId = req.user.id;
  try {
    const adminResult = await db.execute({ sql: 'SELECT * FROM admins WHERE id = ?', args: [adminId] });
    const admin = adminResult.rows[0];
    if (!admin || !bcrypt.compareSync(req.body.oldPassword, admin.password_hash)) {
      return res.status(401).json({ error: 'كلمة المرور القديمة غير صحيحة' });
    }
    const hash = bcrypt.hashSync(req.body.newPassword, bcrypt.genSaltSync(12));
    await db.execute({ sql: 'UPDATE admins SET password_hash = ? WHERE id = ?', args: [hash, adminId] });
    await db.execute({ sql: 'UPDATE sessions SET is_revoked = 1, revoked_reason = ? WHERE admin_id = ?', args: ['password_changed', adminId] });
    await db.execute({
      sql: 'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
      args: [adminId, 'Password Change', JSON.stringify({ ip: req.ip })]
    });
    clearRefreshCookie(res);
    return res.json({ message: 'تم تغيير كلمة المرور بنجاح. يرجى تسجيل الدخول مرة أخرى.' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', authenticateToken, async (req, res) => {
  const refreshToken = getRefreshTokenFromRequest(req);
  try {
    if (refreshToken) {
      await req.app.locals.db.execute({
        sql: 'UPDATE sessions SET is_revoked = 1, revoked_reason = ? WHERE refresh_token = ?',
        args: ['logout', hashRefreshToken(refreshToken)]
      });
    }
    clearRefreshCookie(res);
    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
module.exports.hashRefreshToken = hashRefreshToken;
