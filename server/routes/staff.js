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
], async (req, res) => {
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
  
  try {
    const totalResult = await db.execute({ sql: countQuery, args: params });
    const total = totalResult.rows[0].total;

    queryStr += ' ORDER BY name_ar LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const staffResult = await db.execute({ sql: queryStr, args: params });
    
    res.json({
      data: staffResult.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Staff get error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/admin/staff/export — MUST be before /:id routes
router.get('/export', authenticateToken, async (req, res) => {
  const db = req.app.locals.db;
  
  try {
    const staffResult = await db.execute('SELECT * FROM employees WHERE is_deleted = 0 ORDER BY name_ar');
    const staff = staffResult.rows;

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
    console.error('Export failed:', e);
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
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const db = req.app.locals.db;
  const { name_ar, name_en, employee_id, department, phone, status } = req.body;
  const adminId = req.user.id;

  try {
    const result = await db.execute({
      sql: `
        INSERT INTO employees (name_ar, name_en, employee_id, department, phone, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [name_ar, name_en || null, employee_id || null, department, phone || null, status || 'Active']
    });

    await db.execute({
      sql: 'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
      args: [adminId, 'Add Staff', JSON.stringify({ name: name_ar })]
    });

    res.json({ success: true, id: Number(result.lastInsertRowid) });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Employee ID already exists' });
    } else {
      console.error('Add staff error:', e);
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
], async (req, res) => {
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
    const stmts = [
      {
        sql: `UPDATE employees SET ${updateClauses.join(', ')} WHERE id = ? AND is_deleted = 0`,
        args: params
      },
      {
        sql: 'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
        args: [adminId, 'Update Staff', JSON.stringify({ id, updates })]
      }
    ];

    const results = await db.batch(stmts, "write");
    
    if (results[0].rowsAffected === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    res.json({ success: true });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Employee ID already exists' });
    }
    console.error('Update staff error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/admin/staff/:id (Soft delete)
router.delete('/:id', authenticateToken, [
  param('id').isInt().toInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const db = req.app.locals.db;
  const id = req.params.id;
  const adminId = req.user.id;

  try {
    const stmts = [
      {
        sql: 'UPDATE employees SET is_deleted = 1 WHERE id = ?',
        args: [id]
      },
      {
        sql: 'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
        args: [adminId, 'Delete Staff', JSON.stringify({ id })]
      }
    ];

    const results = await db.batch(stmts, "write");
    if (results[0].rowsAffected === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    res.json({ success: true, message: 'Employee deleted successfully' });
  } catch (e) {
    console.error('Delete staff error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
