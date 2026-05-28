const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { query, validationResult } = require('express-validator');

// GET /api/admin/audit
router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 200 }).toInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const db = req.app.locals.db;
  const page = req.query.page || 1;
  const limit = req.query.limit || 20;
  const offset = (page - 1) * limit;

  try {
    const totalResult = await db.execute('SELECT COUNT(*) as total FROM audit_log');
    const total = totalResult.rows[0].total;

    const logsResult = await db.execute({
      sql: `
        SELECT al.id, al.action, al.details, al.created_at, a.username 
        FROM audit_log al
        LEFT JOIN admins a ON al.admin_id = a.id
        ORDER BY al.id DESC
        LIMIT ? OFFSET ?
      `,
      args: [limit, offset]
    });
    
    res.json({
      data: logsResult.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Audit get error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/admin/audit/export
router.get('/export', authenticateToken, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const logsResult = await db.execute(`
      SELECT al.created_at, a.username, al.action, al.details 
      FROM audit_log al
      LEFT JOIN admins a ON al.admin_id = a.id
      ORDER BY al.id DESC
    `);
    const logs = logsResult.rows;

    let csv;
    try {
      const { stringify } = require('csv-stringify/sync');
      csv = stringify(logs, {
        header: true,
        columns: { created_at: 'Timestamp', username: 'Admin User', action: 'Action', details: 'Details' }
      });
    } catch(e) {
      // Fallback if csv-stringify is not installed
      const headers = 'Timestamp,Admin User,Action,Details\n';
      const rows = logs.map(l => 
        `"${(l.created_at||'').replace(/"/g,'""')}","${(l.username||'').replace(/"/g,'""')}","${(l.action||'').replace(/"/g,'""')}","${(l.details||'').replace(/"/g,'""')}"`
      ).join('\n');
      csv = headers + rows;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit_log.csv"');
    res.send(csv);
  } catch (err) {
    console.error('Audit export error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
