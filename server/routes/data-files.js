const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const authenticateToken = require('../middleware/auth');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

const ALLOWED = {
  chemicals: {
    filename: 'chemicals.json',
    validateItem: (x) =>
      x &&
      typeof x.id === 'string' &&
      typeof x.theme === 'string' &&
      typeof x.name === 'string' &&
      typeof x.code === 'string'
  },
  programs: {
    filename: 'programs.json',
    validateItem: (x) =>
      x &&
      typeof x.id === 'string' &&
      typeof x.type === 'string' &&
      typeof x.number === 'string'
  }
};

function getFilePath(kind) {
  const cfg = ALLOWED[kind];
  if (!cfg) return null;
  return path.join(DATA_DIR, cfg.filename);
}

async function readCatalogue(req, res) {
  const kind = req.params.kind;
  const cfg = ALLOWED[kind];
  const filePath = getFilePath(kind);
  if (!cfg || !filePath) return res.status(400).json({ error: 'Unknown data kind' });

  const db = req.app.locals.db;

  try {
    // 1. Try to get from database first
    const dbResult = await db.execute({
      sql: 'SELECT data FROM json_data WHERE kind = ?',
      args: [kind]
    });

    if (dbResult.rows.length > 0) {
      return res.json({ data: JSON.parse(dbResult.rows[0].data) });
    }

    // 2. If not in DB, fallback to file (seed the database)
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
      const json = JSON.parse(raw);
      
      // Save to database for future requests
      try {
        await db.execute({
          sql: `
            INSERT INTO json_data (kind, data) VALUES (?, ?)
            ON CONFLICT(kind) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP
          `,
          args: [kind, JSON.stringify(json)]
        });
      } catch (dbErr) {
        console.error('Failed to seed database with local data:', dbErr);
      }

      return res.json({ data: json });
    }

    // If neither exists, return empty array
    return res.json({ data: [] });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to read data' });
  }
}

// GET /api/admin/data/:kind
router.get('/:kind', authenticateToken, readCatalogue);

// PUT /api/admin/data/:kind  (replace whole file)
router.put('/:kind', authenticateToken, async (req, res) => {
  const kind = req.params.kind;
  const cfg = ALLOWED[kind];
  if (!cfg) return res.status(400).json({ error: 'Unknown data kind' });

  const body = req.body;
  if (!Array.isArray(body)) {
    return res.status(400).json({ error: 'Body must be an array' });
  }

  const invalidIdx = body.findIndex((x) => !cfg.validateItem(x));
  if (invalidIdx !== -1) {
    return res.status(400).json({ error: `Invalid item at index ${invalidIdx}` });
  }

  // Prevent duplicate ids
  const ids = body.map((x) => x.id);
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    return res.status(400).json({ error: 'Duplicate id detected' });
  }

  const db = req.app.locals.db;

  try {
    const serialized = JSON.stringify(body, null, 2);
    
    // Save to Database
    await db.execute({
      sql: `
        INSERT INTO json_data (kind, data) VALUES (?, ?)
        ON CONFLICT(kind) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP
      `,
      args: [kind, serialized]
    });

    // Attempt to write to local file as backup (will fail silently in Vercel)
    try {
      const filePath = getFilePath(kind);
      if (filePath && fs.existsSync(DATA_DIR)) {
        fs.writeFileSync(filePath, serialized + '\n', 'utf8');
      }
    } catch (fsErr) {
      // Ignore file write errors on serverless environments
      console.log('Skipping local file write in serverless mode');
    }

    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to write data' });
  }
});

module.exports = router;
module.exports.readCatalogue = readCatalogue;
