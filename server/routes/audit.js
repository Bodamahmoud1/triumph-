const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { query, validationResult } = require('express-validator');

// GET /api/admin/audit
router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 200 }).toInt()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const db = req.app.locals.db;
  const page = req.query.page || 1;
  const limit = req.query.limit || 20;
  const offset = (page - 1) * limit;

  const total = db.prepare('SELECT COUNT(*) as total FROM audit_log').get().total;

  const logs = db.prepare(`
    SELECT al.id, al.action, al.details, al.created_at, a.username 
    FROM audit_log al
    LEFT JOIN admins a ON al.admin_id = a.id
    ORDER BY al.id DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
  
  res.json({
    data: logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
});

// GET /api/admin/audit/export
router.get('/export', authenticateToken, (req, res) => {
  const db = req.app.locals.db;
  const logs = db.prepare(`
    SELECT al.created_at, a.username, al.action, al.details 
    FROM audit_log al
    LEFT JOIN admins a ON al.admin_id = a.id
    ORDER BY al.id DESC
  `).all();

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
});

module.exports = router;
