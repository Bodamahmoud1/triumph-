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

function getSeedFilePath(kind) {
  const cfg = ALLOWED[kind];
  if (!cfg) return null;
  return path.join(DATA_DIR, cfg.filename);
}

<<<<<<< HEAD
// GET /api/admin/data/:kind
router.get('/:kind', authenticateToken, async (req, res) => {
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
=======
function ensureCatalogueTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS catalogue_data (
      kind TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_by INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(updated_by) REFERENCES admins(id)
    )
  `);
}

function readSeedData(kind) {
  const cfg = ALLOWED[kind];
  const filePath = getSeedFilePath(kind);
  if (!cfg || !filePath) throw new Error('Unknown data kind');

  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const json = JSON.parse(raw);
  if (!Array.isArray(json)) throw new Error(`Seed data for ${kind} must be an array`);
  return json;
}

function ensureSeeded(db, kind) {
  ensureCatalogueTable(db);
  const existing = db.prepare('SELECT payload FROM catalogue_data WHERE kind = ?').get(kind);
  if (existing) return existing;

  const seedData = readSeedData(kind);
  const payload = JSON.stringify(seedData);
  db.prepare('INSERT INTO catalogue_data (kind, payload) VALUES (?, ?)').run(kind, payload);
  return { payload };
}

function getCatalogueData(db, kind) {
  if (!ALLOWED[kind]) {
    const err = new Error('Unknown data kind');
    err.statusCode = 400;
    throw err;
>>>>>>> c9251826d2e634acb03ab8b0655b798f714a4149
  }

<<<<<<< HEAD
// PUT /api/admin/data/:kind  (replace whole file)
router.put('/:kind', authenticateToken, async (req, res) => {
  const kind = req.params.kind;
  const cfg = ALLOWED[kind];
  if (!cfg) return res.status(400).json({ error: 'Unknown data kind' });
=======
  const row = ensureSeeded(db, kind);
  const data = JSON.parse(row.payload);
  if (!Array.isArray(data)) throw new Error(`Stored data for ${kind} must be an array`);
  return data;
}

function validateCatalogueData(kind, body) {
  const cfg = ALLOWED[kind];
  if (!cfg) {
    return { valid: false, statusCode: 400, error: 'Unknown data kind' };
  }
>>>>>>> c9251826d2e634acb03ab8b0655b798f714a4149

  if (!Array.isArray(body)) {
    return { valid: false, statusCode: 400, error: 'Body must be an array' };
  }

  const invalidIdx = body.findIndex((x) => !cfg.validateItem(x));
  if (invalidIdx !== -1) {
    return { valid: false, statusCode: 400, error: `Invalid item at index ${invalidIdx}` };
  }

  const ids = body.map((x) => x.id);
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    return { valid: false, statusCode: 400, error: 'Duplicate id detected' };
  }

<<<<<<< HEAD
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
=======
  return { valid: true };
}

function replaceCatalogueData(db, kind, body, adminId) {
  const validation = validateCatalogueData(kind, body);
  if (!validation.valid) {
    const err = new Error(validation.error);
    err.statusCode = validation.statusCode;
    throw err;
  }

  ensureCatalogueTable(db);
  const itemCount = body.length;
  const payload = JSON.stringify(body);

  const updateTx = db.transaction(() => {
    db.prepare(`
      INSERT INTO catalogue_data (kind, payload, updated_by, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(kind) DO UPDATE SET
        payload = excluded.payload,
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `).run(kind, payload, adminId || null);

    db.prepare('INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)')
      .run(adminId || null, 'Update Catalogue Data', JSON.stringify({ kind, itemCount, adminId: adminId || null }));
  });

  updateTx();
  return { itemCount };
}

// GET /api/data/:kind and /api/admin/data/:kind
router.get('/:kind', (req, res) => {
  const kind = req.params.kind;

  try {
    return res.json({ data: getCatalogueData(req.app.locals.db, kind) });
  } catch (e) {
    console.error(e);
    return res.status(e.statusCode || 500).json({ error: e.statusCode ? e.message : 'Failed to read catalogue data' });
  }
});

// PUT /api/admin/data/:kind  (replace persisted catalogue payload)
router.put('/:kind', authenticateToken, (req, res) => {
  const kind = req.params.kind;

  try {
    replaceCatalogueData(req.app.locals.db, kind, req.body, req.user.id);
    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(e.statusCode || 500).json({ error: e.statusCode ? e.message : 'Failed to write catalogue data' });
>>>>>>> c9251826d2e634acb03ab8b0655b798f714a4149
  }
});

module.exports = router;
<<<<<<< HEAD
=======
module.exports._private = {
  ALLOWED,
  ensureCatalogueTable,
  ensureSeeded,
  getCatalogueData,
  replaceCatalogueData,
  validateCatalogueData,
  readSeedData
};
>>>>>>> c9251826d2e634acb03ab8b0655b798f714a4149
