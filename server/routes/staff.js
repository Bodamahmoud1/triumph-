const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { body, query, param, validationResult } = require('express-validator');
const ExcelJS = require('exceljs');

// GET /api/admin/staff
router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional().trim().escape(),
  query('status').optional().trim().escape(),
  query('department').optional().trim().escape()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const db = req.app.locals.db;
  const page = req.query.page || 1;
  const limit = req.query.limit || 50;
  const offset = (page - 1) * limit;

  let queryStr = 'SELECT * FROM employees WHERE is_deleted = 0';
  const params = [];

  if (req.query.search) {
    queryStr += ' AND (name_ar LIKE ? OR name_en LIKE ? OR employee_id LIKE ?)';
    const searchPattern = `%${req.query.search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  if (req.query.status) {
    queryStr += ' AND status = ?';
    params.push(req.query.status);
  }

  if (req.query.department) {
    queryStr += ' AND department = ?';
    params.push(req.query.department);
  }

  const countQuery = queryStr.replace('SELECT *', 'SELECT COUNT(*) as total');
  const total = db.prepare(countQuery).get(...params).total;

  queryStr += ' ORDER BY name_ar LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const staff = db.prepare(queryStr).all(...params);
  
  res.json({
    data: staff,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
});

// GET /api/admin/staff/export — MUST be before /:id routes
router.get('/export', authenticateToken, async (req, res) => {
  const db = req.app.locals.db;
  const staff = db.prepare('SELECT * FROM employees WHERE is_deleted = 0 ORDER BY name_ar').all();

  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Employees');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Name (AR)', key: 'name_ar', width: 25 },
      { header: 'Name (EN)', key: 'name_en', width: 25 },
      { header: 'Employee ID', key: 'employee_id', width: 15 },
      { header: 'Department', key: 'department', width: 15 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
    ];
    staff.forEach(emp => sheet.addRow(emp));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="employees.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Export failed' });
  }
});

// POST /api/admin/staff (Add employee)
router.post('/', authenticateToken, [
  body('name_ar').trim().notEmpty().withMessage('Arabic name is required'),
  body('name_en').optional().trim(),
  body('employee_id').optional().trim(),
  body('department').trim().notEmpty().withMessage('Department is required'),
  body('phone').optional().trim(),
  body('status').optional().trim().isIn(['Active', 'Inactive', 'On Leave', 'Resigned']).withMessage('Invalid status')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const db = req.app.locals.db;
  const { name_ar, name_en, employee_id, department, phone, status } = req.body;
  const adminId = req.user.id;

  try {
    const result = db.prepare(`
      INSERT INTO employees (name_ar, name_en, employee_id, department, phone, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name_ar, name_en || null, employee_id || null, department, phone || null, status || 'Active');

    db.prepare('INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)')
      .run(adminId, 'Add Staff', JSON.stringify({ name: name_ar }));

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({ error: 'Employee ID already exists' });
    } else {
      res.status(500).json({ error: 'Database error' });
    }
  }
});

// PATCH /api/admin/staff/:id (Update employee)
router.patch('/:id', authenticateToken, [
  param('id').isInt().toInt(),
  body('name_ar').optional().trim().notEmpty(),
  body('name_en').optional().trim(),
  body('employee_id').optional().trim(),
  body('department').optional().trim().notEmpty(),
  body('phone').optional().trim(),
  body('status').optional().trim().isIn(['Active', 'Inactive', 'On Leave', 'Resigned'])
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const db = req.app.locals.db;
  const id = req.params.id;
  const updates = req.body;
  const adminId = req.user.id;

  const allowedFields = ['name_ar', 'name_en', 'employee_id', 'department', 'phone', 'status'];
  const updateClauses = [];
  const params = [];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      updateClauses.push(`${field} = ?`);
      params.push(updates[field]);
    }
  }

  if (updateClauses.length === 0) return res.status(400).json({ error: 'No fields to update' });

  params.push(id);

  try {
    const tx = db.transaction(() => {
      const info = db.prepare(`UPDATE employees SET ${updateClauses.join(', ')} WHERE id = ? AND is_deleted = 0`).run(...params);
      if (info.changes === 0) {
        const err = new Error('Employee not found');
        err.statusCode = 404;
        throw err;
      }
      db.prepare('INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)')
        .run(adminId, 'Update Staff', JSON.stringify({ id, updates }));
    });
    tx();
    res.json({ success: true });
  } catch (e) {
    if (e.statusCode === 404) {
      return res.status(404).json({ error: e.message });
    }
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'Employee ID already exists' });
    }
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/admin/staff/:id (Soft delete)
router.delete('/:id', authenticateToken, [
  param('id').isInt().toInt()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const db = req.app.locals.db;
  const id = req.params.id;
  const adminId = req.user.id;

  try {
    const info = db.prepare('UPDATE employees SET is_deleted = 1 WHERE id = ?').run(id);
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    db.prepare('INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)')
      .run(adminId, 'Delete Staff', JSON.stringify({ id }));
    
    res.json({ success: true, message: 'Employee deleted successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
