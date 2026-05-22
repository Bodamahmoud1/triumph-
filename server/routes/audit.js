const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { stringify } = require('csv-stringify/sync');

// GET /api/admin/audit
router.get('/', authenticateToken, (req, res) => {
  const db = req.app.locals.db;
  // Basic pagination could be added here
  const logs = db.prepare(`
    SELECT al.id, al.action, al.details, al.created_at, a.username 
    FROM audit_log al
    LEFT JOIN admins a ON al.admin_id = a.id
    ORDER BY al.id DESC
    LIMIT 200
  `).all();
  
  res.json({ data: logs });
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

  const csv = stringify(logs, {
    header: true,
    columns: { created_at: 'Timestamp', username: 'Admin User', action: 'Action', details: 'Details' }
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="audit_log.csv"');
  res.send(csv);
});

module.exports = router;
