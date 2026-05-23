const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');

/**
 * Whitelist of sections and their allowed field keys.
 * PATCH requests are rejected if they contain keys outside this list.
 * Add new keys here as the content model grows.
 */
const ALLOWED_CONTENT_KEYS = {
  intro:     ['hotel_name', 'dept_name', 'guide_label', 'guide_sub', 'member1_name', 'member1_role', 'member2_name', 'member2_role', 'member3_name', 'member3_role'],
  chemicals: ['section_title', 'section_sub', 'filter_label'],
  programs:  ['section_title', 'section_sub'],
  tips:      ['section_title', 'section_sub'],
  footer:    ['brand_name', 'dept_label', 'copy_text']
};

// GET /api/admin/content/:section
router.get('/:section', authenticateToken, (req, res) => {
  const db      = req.app.locals.db;
  const section = req.params.section;

  if (!ALLOWED_CONTENT_KEYS[section]) {
    return res.status(400).json({ error: 'Unknown content section' });
  }

  const rows = db.prepare('SELECT field_key, value FROM content WHERE section = ?').all(section);

  const contentMap = {};
  rows.forEach(r => { contentMap[r.field_key] = r.value; });

  res.json({ data: contentMap });
});

// PATCH /api/admin/content/:section
router.patch('/:section', authenticateToken, (req, res) => {
  const db      = req.app.locals.db;
  const section = req.params.section;
  const updates = req.body;
  const adminId = req.user.id;

  const allowedKeys = ALLOWED_CONTENT_KEYS[section];
  if (!allowedKeys) {
    return res.status(400).json({ error: 'Unknown content section' });
  }

  // Reject any key not in the whitelist
  const unknownKeys = Object.keys(updates).filter(k => !allowedKeys.includes(k));
  if (unknownKeys.length > 0) {
    return res.status(400).json({ error: `Unknown field key(s): ${unknownKeys.join(', ')}` });
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No fields provided' });
  }

  try {
    const updateTx = db.transaction(() => {
      const upsert = db.prepare(`
        INSERT INTO content (section, field_key, value)
        VALUES (?, ?, ?)
        ON CONFLICT(section, field_key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `);

      for (const [key, val] of Object.entries(updates)) {
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
