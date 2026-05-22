const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');

// GET /api/admin/content/:section
router.get('/:section', authenticateToken, (req, res) => {
  const db = req.app.locals.db;
  const section = req.params.section;

  const rows = db.prepare('SELECT field_key, value FROM content WHERE section = ?').all(section);
  
  // Format as key:value object
  const contentMap = {};
  rows.forEach(r => contentMap[r.field_key] = r.value);
  
  res.json({ data: contentMap });
});

// PATCH /api/admin/content/:section
router.patch('/:section', authenticateToken, (req, res) => {
  const db = req.app.locals.db;
  const section = req.params.section;
  const updates = req.body; // { "intro_title": "New Title", ... }
  const adminId = req.user.id;

  try {
    const updateTx = db.transaction(() => {
      const upsert = db.prepare(`
        INSERT INTO content (section, field_key, value) 
        VALUES (?, ?, ?)
        ON CONFLICT(section, field_key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `);

      for (const [key, val] of Object.entries(updates)) {
        // Simple sanitization: just stringify everything (prevents sql injection via better-sqlite3 bindings anyway)
        upsert.run(section, key, String(val));
      }

      db.prepare('INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)')
        .run(adminId, 'Edit Content', JSON.stringify({ section, fields: Object.keys(updates) }));
    });

    updateTx();
    res.json({ success: true, message: 'Content updated successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error updating content' });
  }
});

module.exports = router;
