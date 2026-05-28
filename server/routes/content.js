const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');

<<<<<<< HEAD
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
=======
const MAX_JSON_STRING_LENGTH = 20000;

const EDITABLE_CONTENT_SECTIONS = Object.freeze({
  intro: Object.freeze({
    title_ar: Object.freeze({ type: 'string', maxLength: 200, required: true }),
    body_ar: Object.freeze({ type: 'string', maxLength: 1000, required: true }),
    title_en: Object.freeze({ type: 'string', maxLength: 200, required: false }),
    body_en: Object.freeze({ type: 'string', maxLength: 1000, required: false })
  }),
  tips: Object.freeze({
    title_ar: Object.freeze({ type: 'string', maxLength: 200, required: false }),
    title_en: Object.freeze({ type: 'string', maxLength: 200, required: false }),
    content_ar: Object.freeze({ type: 'string', maxLength: 1000, required: false }),
    content_en: Object.freeze({ type: 'string', maxLength: 1000, required: false }),
    cards_json: Object.freeze({ type: 'json', maxLength: MAX_JSON_STRING_LENGTH, required: false })
  })
});

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseJsonField(value, key, maxLength) {
  let parsed = value;

  if (typeof value === 'string') {
    if (value.length > maxLength) {
      return { error: `${key} must be ${maxLength} characters or fewer` };
    }

    try {
      parsed = value.trim() ? JSON.parse(value) : [];
    } catch (e) {
      return { error: `${key} must contain valid JSON` };
    }
  } else if (value === null || typeof value !== 'object') {
    return { error: `${key} must be a JSON object or array` };
  }

  const serialized = JSON.stringify(parsed);
  if (serialized.length > maxLength) {
    return { error: `${key} must be ${maxLength} characters or fewer` };
  }

  return { value: serialized };
}

function validateContentUpdates(section, updates) {
  const schema = EDITABLE_CONTENT_SECTIONS[section];
  if (!schema) {
    return { error: `Unknown content section: ${section}` };
  }

  if (!isPlainObject(updates)) {
    return { error: 'Request body must be a JSON object' };
  }

  const normalized = {};
  const allowedKeys = Object.keys(schema);

  for (const key of allowedKeys) {
    const field = schema[key];
    if (field.required && !Object.prototype.hasOwnProperty.call(updates, key)) {
      return { error: `${key} is required for ${section}` };
    }
  }

  for (const [key, value] of Object.entries(updates)) {
    const field = schema[key];
    if (!field) {
      return { error: `Unknown content field: ${key}` };
    }

    if (field.type === 'json') {
      const result = parseJsonField(value, key, field.maxLength);
      if (result.error) return result;
      normalized[key] = result.value;
      continue;
    }

    if (field.type !== 'string') {
      return { error: `Unsupported content field type for ${key}` };
    }

    if (typeof value !== 'string') {
      return { error: `${key} must be a string` };
    }

    if (field.required && value.trim() === '') {
      return { error: `${key} is required for ${section}` };
    }

    if (value.length > field.maxLength) {
      return { error: `${key} must be ${field.maxLength} characters or fewer` };
    }

    normalized[key] = value;
  }

  return { value: normalized };
}

function getSectionContent(db, section) {
  const rows = db.prepare('SELECT field_key, value FROM content WHERE section = ?').all(section);

  const contentMap = {};
  rows.forEach(r => contentMap[r.field_key] = r.value);
  return contentMap;
}

function ensureKnownSection(req, res, next) {
  if (!EDITABLE_CONTENT_SECTIONS[req.params.section]) {
    return res.status(400).json({ error: `Unknown content section: ${req.params.section}` });
  }

  next();
}

// GET /api/content/:section and /api/admin/content/:section
router.get('/:section', ensureKnownSection, (req, res) => {
  const db = req.app.locals.db;
  const section = req.params.section;

  res.json({ data: getSectionContent(db, section) });
});

// PATCH /api/admin/content/:section
router.patch('/:section', authenticateToken, ensureKnownSection, (req, res) => {
>>>>>>> c9251826d2e634acb03ab8b0655b798f714a4149
  const db = req.app.locals.db;
  const section = req.params.section;
  const adminId = req.user.id;
  const result = validateContentUpdates(section, req.body);

  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  const updates = result.value;

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

<<<<<<< HEAD
    stmts.push({
      sql: 'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
      args: [adminId, 'Edit Content', JSON.stringify({ section, fields: Object.keys(updates) })]
=======
      for (const [key, val] of Object.entries(updates)) {
        upsert.run(section, key, val);
      }

      db.prepare('INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)')
        .run(adminId, 'Edit Content', JSON.stringify({ section, fields: Object.keys(updates) }));
>>>>>>> c9251826d2e634acb03ab8b0655b798f714a4149
    });

    await db.batch(stmts, "write");
    res.json({ success: true, message: 'Content updated successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error updating content' });
  }
});

module.exports = router;
module.exports.EDITABLE_CONTENT_SECTIONS = EDITABLE_CONTENT_SECTIONS;
module.exports.validateContentUpdates = validateContentUpdates;
