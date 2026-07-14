const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');

const CONTENT_SCHEMA = {
  intro: {
    title_ar: { maxLength: 200 },
    body_ar: { maxLength: 1000 },
    title_en: { maxLength: 200 },
    body_en: { maxLength: 1000 }
  },
  tips: {
    icon: { maxLength: 32 },
    title_ar: { maxLength: 200 },
    title_en: { maxLength: 200 },
    content_ar: { maxLength: 1000 },
    content_en: { maxLength: 1000 },
    cards_json: { maxLength: 50000, json: true }
  }
};

function validateContentUpdates(section, updates) {
  const fields = CONTENT_SCHEMA[section];
  if (!fields) return { error: `Unknown content section: ${section}` };
  if (!updates || Array.isArray(updates) || typeof updates !== 'object') {
    return { error: 'Request body must be a JSON object' };
  }

  const value = {};
  for (const [key, rawValue] of Object.entries(updates)) {
    const definition = fields[key];
    if (!definition) return { error: `Unknown content field: ${key}` };

    let normalized;
    if (definition.json) {
      try {
        normalized = typeof rawValue === 'string' ? JSON.stringify(JSON.parse(rawValue)) : JSON.stringify(rawValue);
      } catch (error) {
        return { error: `${key} must contain valid JSON` };
      }
    } else {
      if (typeof rawValue !== 'string') return { error: `${key} must be a string` };
      normalized = rawValue;
    }

    if (normalized.length > definition.maxLength) {
      return { error: `${key} must be ${definition.maxLength} characters or fewer` };
    }
    value[key] = normalized;
  }

  return { value };
}

async function readContent(req, res) {
  const section = req.params.section;
  if (!CONTENT_SCHEMA[section]) return res.status(404).json({ error: 'Unknown content section' });

  try {
    const rowsResult = await req.app.locals.db.execute({
      sql: 'SELECT field_key, value FROM content WHERE section = ?',
      args: [section]
    });
    const data = {};
    rowsResult.rows.forEach((row) => { data[row.field_key] = row.value; });
    return res.json({ data });
  } catch (error) {
    console.error('Content read error:', error);
    return res.status(500).json({ error: 'Database error fetching content' });
  }
}

// GET /api/admin/content/:section
router.get('/:section', authenticateToken, readContent);

// PATCH /api/admin/content/:section
router.patch('/:section', authenticateToken, async (req, res) => {
  const section = req.params.section;
  const validated = validateContentUpdates(section, req.body);
  if (validated.error) return res.status(400).json({ error: validated.error });

  const updates = validated.value;
  const entries = Object.entries(updates);
  if (!entries.length) return res.status(400).json({ error: 'At least one content field is required' });

  const db = req.app.locals.db;
  const statements = entries.map(([key, value]) => ({
    sql: `
      INSERT INTO content (section, field_key, value)
      VALUES (?, ?, ?)
      ON CONFLICT(section, field_key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `,
    args: [section, key, value]
  }));
  statements.push({
    sql: 'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
    args: [req.user.id, 'Edit Content', JSON.stringify({ section, fields: Object.keys(updates) })]
  });

  try {
    await db.batch(statements, 'write');
    return res.json({ success: true, message: 'Content updated successfully' });
  } catch (error) {
    console.error('Content update error:', error);
    return res.status(500).json({ error: 'Database error updating content' });
  }
});

module.exports = router;
module.exports.validateContentUpdates = validateContentUpdates;
module.exports.readContent = readContent;
