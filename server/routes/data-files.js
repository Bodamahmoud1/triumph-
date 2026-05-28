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

// GET /api/admin/data/:kind
router.get('/:kind', authenticateToken, (req, res) => {
  const kind = req.params.kind;
  const cfg = ALLOWED[kind];
  const filePath = getFilePath(kind);
  if (!cfg || !filePath) return res.status(400).json({ error: 'Unknown data kind' });

  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    const json = JSON.parse(raw);
    return res.json({ data: json });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to read data file' });
  }
});

// PUT /api/admin/data/:kind  (replace whole file)
router.put('/:kind', authenticateToken, (req, res) => {
  const kind = req.params.kind;
  const cfg = ALLOWED[kind];
  const filePath = getFilePath(kind);
  if (!cfg || !filePath) return res.status(400).json({ error: 'Unknown data kind' });

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

  try {
    const serialized = JSON.stringify(body, null, 2) + '\n';
    fs.writeFileSync(filePath, serialized, 'utf8');
    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to write data file' });
  }
});

module.exports = router;

