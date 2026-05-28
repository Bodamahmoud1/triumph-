const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');

// GET /api/admin/content/:section
router.get('/:section', authenticateToken, async (req, res) => {
  const db = req.app.locals.db;
  const section = req.params.section;

  try {
    const rowsResult = await db.execute({ sql: 'SELECT field_key, value FROM content WHERE section = ?', args: [section] });
    
    // Format as key:value object
    const contentMap = {};
    rowsResult.rows.forEach(r => contentMap[r.field_key] = r.value);
    
    res.json({ data: contentMap });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching content' });
  }
});

// PATCH /api/admin/content/:section
router.patch('/:section', authenticateToken, async (req, res) => {
  const db = req.app.locals.db;
  const section = req.params.section;
  const updates = req.body; // { "intro_title": "New Title", ... }
  const adminId = req.user.id;

  try {
    const stmts = [];
    for (const [key, val] of Object.entries(updates)) {
      stmts.push({
        sql: `
          INSERT INTO content (section, field_key, value) 
          VALUES (?, ?, ?)
          ON CONFLICT(section, field_key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `,
        args: [section, key, String(val)]
      });
    }

    stmts.push({
      sql: 'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
      args: [adminId, 'Edit Content', JSON.stringify({ section, fields: Object.keys(updates) })]
    });

    await db.batch(stmts, "write");
    res.json({ success: true, message: 'Content updated successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error updating content' });
  }
});

module.exports = router;
