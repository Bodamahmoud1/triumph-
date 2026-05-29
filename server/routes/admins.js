const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const authenticateToken = require('../middleware/auth');

function insertId(result) {
  const id = result?.lastInsertRowid ?? result?.lastInsertRowId;
  return Number(id);
}

// GET /api/admin/admins
router.get('/', authenticateToken, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = await db.execute(`
      SELECT id, username, created_at
      FROM admins
      ORDER BY created_at ASC, id ASC
    `);
    res.json({ data: result.rows });
  } catch (err) {
    console.error('List admins error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/admin/admins
router.post('/', authenticateToken, [
  body('username')
    .trim()
    .notEmpty().withMessage('اسم المستخدم مطلوب')
    .isLength({ min: 3, max: 32 }).withMessage('اسم المستخدم من 3 إلى 32 حرفاً')
    .matches(/^[a-zA-Z0-9._-]+$/).withMessage('اسم المستخدم: حروف إنجليزية وأرقام و . _ - فقط'),
  body('password')
    .isLength({ min: 8 }).withMessage('كلمة المرور 8 أحرف على الأقل')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { username, password } = req.body;
  const db = req.app.locals.db;
  const creatorId = req.user.id;

  try {
    const existing = await db.execute({
      sql: 'SELECT id FROM admins WHERE username = ?',
      args: [username]
    });
    if (existing.rows[0]) {
      return res.status(409).json({ error: 'اسم المستخدم مستخدم بالفعل' });
    }

    const salt = bcrypt.genSaltSync(12);
    const passwordHash = bcrypt.hashSync(password, salt);

    const insertResult = await db.execute({
      sql: 'INSERT INTO admins (username, password_hash) VALUES (?, ?)',
      args: [username, passwordHash]
    });
    const newId = insertId(insertResult);
    if (!newId) {
      return res.status(500).json({ error: 'فشل إنشاء الحساب' });
    }

    await db.execute({
      sql: 'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
      args: [
        creatorId,
        'Create Admin',
        JSON.stringify({ newAdminId: newId, newUsername: username })
      ]
    });

    res.status(201).json({
      message: 'تم إنشاء حساب المشرف بنجاح',
      data: { id: newId, username, created_at: new Date().toISOString() }
    });
  } catch (err) {
    console.error('Create admin error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
