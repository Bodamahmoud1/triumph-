const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authenticateToken = require('../middleware/auth');
const { parseScheduleExcel, PREVIEW_SAMPLE_LIMIT } = require('../utils/excel');
const {
  sanitizeUploadedFilename,
  createStoredXlsxFilename,
  validateXlsxUploadMetadata,
  validateXlsxBuffer
} = require('../utils/uploadSecurity');
const { body, query, param, validationResult } = require('express-validator');

function insertId(result) {
  const id = result?.lastInsertRowid ?? result?.lastInsertRowId;
  return Number(id);
}

const ROSTER_SHIFT_ORDER = ['Morning', 'Evening', 'Night'];

function normaliseShiftGroup(value) {
  const group = String(value || '').trim();
  return ROSTER_SHIFT_ORDER.includes(group) ? group : null;
}

function rosterRowKey(employeeId, nameAr, shiftGroup) {
  return `${employeeId || nameAr}::${shiftGroup || 'Morning'}`;
}

async function insertScheduleShift(tx, scheduleId, empId, day, shiftVal, shiftGroup) {
  try {
    await tx.execute({
      sql: 'INSERT INTO schedule_shifts (schedule_id, employee_id, day, shift, shift_group) VALUES (?, ?, ?, ?, ?)',
      args: [scheduleId, empId, day, shiftVal, shiftGroup]
    });
  } catch (e) {
    const msg = String(e.message || e);
    if (!/no such column.*shift_group/i.test(msg)) throw e;
    await tx.execute({
      sql: 'INSERT INTO schedule_shifts (schedule_id, employee_id, day, shift) VALUES (?, ?, ?, ?)',
      args: [scheduleId, empId, day, shiftVal]
    });
  }
}

function compareRosterRows(a, b) {
  const orderA = ROSTER_SHIFT_ORDER.indexOf(a.shift_group || 'Morning');
  const orderB = ROSTER_SHIFT_ORDER.indexOf(b.shift_group || 'Morning');
  const rankA = orderA === -1 ? ROSTER_SHIFT_ORDER.length : orderA;
  const rankB = orderB === -1 ? ROSTER_SHIFT_ORDER.length : orderB;
  if (rankA !== rankB) return rankA - rankB;
  return String(a.name_ar || '').localeCompare(String(b.name_ar || ''), 'ar');
}

async function getSiblingWeeks(db, scheduleRow) {
  if (!scheduleRow) return [];
  const filename = scheduleRow.original_filename;
  const publishedAt = scheduleRow.published_at;
  if (!filename || !publishedAt) {
    const single = await db.execute({
      sql: `
        SELECT week_key, week_start
        FROM schedules
        WHERE id = ? AND is_active = 1
      `,
      args: [scheduleRow.id]
    });
    return single.rows;
  }
  const result = await db.execute({
    sql: `
      SELECT week_key, week_start
      FROM schedules
      WHERE is_active = 1
        AND original_filename = ?
        AND published_at = ?
      ORDER BY week_start ASC, week_key ASC
    `,
    args: [filename, publishedAt]
  });
  return result.rows;
}

// Multer setup for temporary Excel uploads
const isVercel = process.env.VERCEL === '1';
const uploadDir = isVercel ? '/tmp/uploads' : path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    cb(null, createStoredXlsxFilename(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    try {
      file.safeOriginalName = sanitizeUploadedFilename(file.originalname);
      validateXlsxUploadMetadata(file);
      cb(null, true);
    } catch (e) {
      cb(e, false);
    }
  }
});

// Helper to cleanup old previews from DB and filesystem
async function cleanupPreviews(db) {
  try {
    const oldPreviewsResult = await db.execute("SELECT * FROM schedule_previews WHERE created_at < datetime('now', '-1 hour')");
    for (const p of oldPreviewsResult.rows) {
      try { fs.unlinkSync(p.file_path); } catch(e){}
    }
    await db.execute("DELETE FROM schedule_previews WHERE created_at < datetime('now', '-1 hour')");
  } catch (err) {
    console.error('Cleanup previews error:', err);
  }
}

// GET /api/schedule/weeks - PUBLIC list of active published weeks
router.get('/schedule/weeks', async (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = await db.execute(`
      SELECT week_key, week_start, published_at, original_filename
      FROM schedules
      WHERE is_active = 1
      ORDER BY week_start ASC, week_key ASC
    `);
    res.json({ weeks: result.rows });
  } catch (err) {
    console.error('List schedule weeks error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/schedule - PUBLIC (No Auth)
router.get('/schedule', [
  query('week').optional().trim().escape()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const db = req.app.locals.db;
  let weekKey = req.query.week;
  
  try {
    let scheduleRow;
    if (weekKey) {
      const resData = await db.execute({ sql: 'SELECT * FROM schedules WHERE week_key = ? AND is_active = 1 ORDER BY id DESC LIMIT 1', args: [weekKey] });
      scheduleRow = resData.rows[0];
    } else {
      const resData = await db.execute('SELECT * FROM schedules WHERE is_active = 1 ORDER BY id DESC LIMIT 1');
      scheduleRow = resData.rows[0];
    }

    if (!scheduleRow) {
      return res.json({ data: null, message: 'لا يوجد جدول منشور لهذا الأسبوع' });
    }

    const shiftsResult = await db.execute({
      sql: `
        SELECT ss.day, ss.shift, ss.shift_group, e.name_ar, e.name_en, e.department, e.employee_id
        FROM schedule_shifts ss
        JOIN employees e ON ss.employee_id = e.id
        WHERE ss.schedule_id = ?
        ORDER BY ss.shift_group ASC, e.name_ar ASC, ss.day ASC
      `,
      args: [scheduleRow.id]
    });

    const usesShiftGroups = shiftsResult.rows.some((row) => normaliseShiftGroup(row.shift_group));
    const employeesMap = {};
    shiftsResult.rows.forEach((row) => {
      const shiftGroup = normaliseShiftGroup(row.shift_group)
        || normaliseShiftGroup(row.shift)
        || 'Morning';
      const key = usesShiftGroups
        ? rosterRowKey(row.employee_id, row.name_ar, shiftGroup)
        : (row.employee_id || row.name_ar);

      if (!employeesMap[key]) {
        employeesMap[key] = {
          name_ar: row.name_ar,
          name_en: row.name_en,
          department: row.department,
          employee_id: row.employee_id,
          shift_group: usesShiftGroups ? shiftGroup : null,
          shifts: {}
        };
      }
      employeesMap[key].shifts[row.day] = row.shift;
      if (!employeesMap[key].shift_group && usesShiftGroups) {
        employeesMap[key].shift_group = shiftGroup;
      }
    });

    const employees = Object.values(employeesMap).sort(compareRosterRows);
    const siblings = await getSiblingWeeks(db, scheduleRow);
    const siblingIndex = siblings.findIndex((w) => w.week_key === scheduleRow.week_key);

    res.json({
      data: {
        week_key: scheduleRow.week_key,
        week_start: scheduleRow.week_start,
        employees,
        siblings,
        sibling_index: siblingIndex
      }
    });
  } catch (err) {
    console.error('Get schedule error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/admin/schedule/upload - AUTH REQUIRED
router.post('/admin/schedule/upload', authenticateToken, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const db = req.app.locals.db;

    try {
      validateXlsxBuffer(fs.readFileSync(req.file.path));
    } catch (e) {
      try { fs.unlinkSync(req.file.path); } catch (cleanupError) {}
      return res.status(400).json({ error: e.message });
    }

    try {
      const parseResult = await parseScheduleExcel(req.file.path);

      const previewId = Date.now().toString() + Math.floor(Math.random() * 1000);
      const payload = { weeks: parseResult.weeks };

      await db.execute({
        sql: 'INSERT INTO schedule_previews (id, file_path, original_name, data_json) VALUES (?, ?, ?, ?)',
        args: [
          previewId,
          req.file.path,
          req.file.safeOriginalName || sanitizeUploadedFilename(req.file.originalname),
          JSON.stringify(payload)
        ]
      });

      cleanupPreviews(db);

      const weekMeta = parseResult.weeks.map((week) => ({
        week_key: week.week_key,
        week_start: week.week_start,
        rowCount: (week.rows || []).length
      }));

      res.json({
        previewId,
        valid: parseResult.valid,
        errors: parseResult.errors,
        summary: parseResult.summary,
        previewSample: parseResult.previewSample,
        previewLimit: PREVIEW_SAMPLE_LIMIT,
        weeks: weekMeta
      });
    } catch (e) {
      console.error('Upload error:', e);
      try { fs.unlinkSync(req.file.path); } catch (cleanupError) {}
      res.status(500).json({ error: e.message || 'Error parsing Excel file' });
    }
  });
});

// POST /api/admin/schedule/publish - AUTH REQUIRED
router.post('/admin/schedule/publish', authenticateToken, [
  body('previewId').trim().notEmpty().withMessage('Preview ID required'),
  body('week_key').optional().trim(),
  body('week_start').optional().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { previewId, week_key, week_start } = req.body;
  const db = req.app.locals.db;
  const adminId = req.user.id;

  try {
    const previewResult = await db.execute({ sql: 'SELECT * FROM schedule_previews WHERE id = ?', args: [previewId] });
    const previewRecord = previewResult.rows[0];

    if (!previewRecord) {
      return res.status(400).json({ error: 'Invalid or expired preview ID' });
    }

    const schedulePayload = JSON.parse(previewRecord.data_json);
    const weeksToPublish = Array.isArray(schedulePayload.weeks) && schedulePayload.weeks.length
      ? schedulePayload.weeks
      : [{
          week_key,
          week_start: week_start || week_key,
          rows: Array.isArray(schedulePayload) ? schedulePayload : (schedulePayload.data || [])
        }];

    const weeksWithRows = weeksToPublish.filter((week) => week.rows && week.rows.length > 0);
    if (!weeksWithRows.length) {
      return res.status(400).json({ error: 'Schedule preview is empty' });
    }

    const resolvedKeys = weeksWithRows.map((week, index) => {
      const key = week.week_key || week_key;
      if (!key) return null;
      return key;
    });
    if (resolvedKeys.some((key) => !key)) {
      return res.status(400).json({ error: 'Week key could not be determined from the uploaded file' });
    }
    if (new Set(resolvedKeys).size !== resolvedKeys.length) {
      return res.status(400).json({ error: 'Duplicate week keys in workbook — check date row in Excel' });
    }

    const publishedWeekKeys = [];
    const tx = await db.transaction('write');
    try {
      for (const week of weeksWithRows) {
        const resolvedWeekKey = week.week_key || week_key;
        const resolvedWeekStart = week.week_start || week_start || resolvedWeekKey;

        if (!resolvedWeekKey || !resolvedWeekStart) {
          throw new Error('Week key/start could not be determined from the uploaded file');
        }
        publishedWeekKeys.push(resolvedWeekKey);

        await tx.execute({ sql: 'UPDATE schedules SET is_active = 0 WHERE week_key = ?', args: [resolvedWeekKey] });

        const schedResult = await tx.execute({
          sql: `
            INSERT INTO schedules (week_key, week_start, published_by, is_active, original_filename)
            VALUES (?, ?, ?, 1, ?)
          `,
          args: [resolvedWeekKey, resolvedWeekStart, adminId, previewRecord.original_name]
        });

        const newSchedId = insertId(schedResult);
        if (!newSchedId) {
          throw new Error('Failed to create schedule record');
        }

        const empsRes = await tx.execute('SELECT id, name_ar, employee_id FROM employees');
        const empsByCode = new Map();
        const empsByName = new Map();
        for (const e of empsRes.rows) {
          if (e.employee_id) empsByCode.set(String(e.employee_id), e.id);
          empsByName.set(e.name_ar, e.id);
        }

        const employeeUpdates = [];
        const shiftStatements = [];

        for (const row of week.rows || []) {
          const employeeCode = row.employeeId || row.employee_id || null;
          let empId = null;
          let needsUpdate = false;

          if (employeeCode && empsByCode.has(String(employeeCode))) {
            empId = empsByCode.get(String(employeeCode));
            needsUpdate = true;
          } else if (empsByName.has(row.name)) {
            empId = empsByName.get(row.name);
            needsUpdate = true;
          }

          if (empId && needsUpdate) {
             employeeUpdates.push({
                sql: 'UPDATE employees SET name_ar = ?, department = ?, status = ?, is_deleted = 0 WHERE id = ?',
                args: [row.name, row.department, 'Active', empId]
             });
          } else {
             const empResult = await tx.execute({
                sql: 'INSERT INTO employees (name_ar, employee_id, department, status, is_deleted) VALUES (?, ?, ?, ?, 0)',
                args: [row.name, employeeCode, row.department, 'Active']
             });
             empId = insertId(empResult);
             if (employeeCode) empsByCode.set(String(employeeCode), empId);
             empsByName.set(row.name, empId);
          }

          const shiftGroup = normaliseShiftGroup(row.shiftGroup || row.shift_group) || 'Morning';
          for (const [day, shiftVal] of Object.entries(row.shifts || {})) {
            shiftStatements.push({
               sql: 'INSERT INTO schedule_shifts (schedule_id, employee_id, day, shift, shift_group) VALUES (?, ?, ?, ?, ?)',
               args: [newSchedId, empId, day, shiftVal, shiftGroup]
            });
          }
        }

        for (let i = 0; i < employeeUpdates.length; i += 50) {
          await tx.batch(employeeUpdates.slice(i, i + 50));
        }

        for (let i = 0; i < shiftStatements.length; i += 50) {
          try {
             await tx.batch(shiftStatements.slice(i, i + 50));
          } catch(e) {
             const msg = String(e.message || e);
             if (/no such column.*shift_group/i.test(msg)) {
               const fallbackChunk = shiftStatements.slice(i, i + 50).map(stmt => ({
                 sql: 'INSERT INTO schedule_shifts (schedule_id, employee_id, day, shift) VALUES (?, ?, ?, ?)',
                 args: stmt.args.slice(0, 4)
               }));
               await tx.batch(fallbackChunk);
             } else {
               throw e;
             }
          }
        }

        await tx.execute({
          sql: 'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
          args: [adminId, 'Publish Schedule', JSON.stringify({ week: resolvedWeekKey, rows: (week.rows || []).length })]
        });
      }

      await tx.commit();
    } catch (e) {
      await tx.rollback();
      throw e;
    }

    await db.execute({ sql: 'DELETE FROM schedule_previews WHERE id = ?', args: [previewId] });
    try { fs.unlinkSync(previewRecord.file_path); } catch (e) {}

    res.json({
      success: true,
      message: 'Schedule published successfully',
      publishedWeeks: publishedWeekKeys,
      weekCount: publishedWeekKeys.length
    });
  } catch (e) {
    console.error('Publish error:', e);
    res.status(500).json({ error: e.message || 'Database error during publish' });
  }
});

// GET /api/admin/schedule/history - AUTH REQUIRED
router.get('/admin/schedule/history', authenticateToken, [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const db = req.app.locals.db;
  const page = req.query.page || 1;
  const limit = req.query.limit || 10;
  const offset = (page - 1) * limit;

  try {
    const totalResult = await db.execute('SELECT COUNT(*) as total FROM schedules');
    const total = totalResult.rows[0].total;

    const historyResult = await db.execute({
      sql: `
        SELECT s.id, s.week_key, s.published_at, s.is_active, s.original_filename, a.username as publisher
        FROM schedules s
        LEFT JOIN admins a ON s.published_by = a.id
        ORDER BY s.id DESC LIMIT ? OFFSET ?
      `,
      args: [limit, offset]
    });
    
    res.json({ 
      data: historyResult.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/admin/schedule/restore/:id - AUTH REQUIRED
router.post('/admin/schedule/restore/:id', authenticateToken, [
  param('id').isInt().toInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const db = req.app.locals.db;
  const idToRestore = req.params.id;
  const adminId = req.user.id;

  try {
    const targetSchedResult = await db.execute({ sql: 'SELECT * FROM schedules WHERE id = ?', args: [idToRestore] });
    const targetSched = targetSchedResult.rows[0];
    
    if (!targetSched) return res.status(404).json({ error: 'Schedule not found' });

    const tx = await db.transaction('write');
    try {
      await tx.execute({ sql: 'UPDATE schedules SET is_active = 0 WHERE week_key = ?', args: [targetSched.week_key] });
      await tx.execute({ sql: 'UPDATE schedules SET is_active = 1 WHERE id = ?', args: [idToRestore] });
      await tx.execute({
        sql: 'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
        args: [adminId, 'Restore Schedule', JSON.stringify({ week: targetSched.week_key, id: idToRestore })]
      });
      await tx.commit();
    } catch (e) {
      await tx.rollback();
      throw e;
    }
    res.json({ success: true, message: 'Schedule restored' });
  } catch(e) {
    console.error('Restore error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/admin/schedule/:id - AUTH REQUIRED
router.delete('/admin/schedule/:id', authenticateToken, [
  param('id').isInt().toInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const db = req.app.locals.db;
  const scheduleId = req.params.id;
  const adminId = req.user.id;

  try {
    const targetResult = await db.execute({ sql: 'SELECT * FROM schedules WHERE id = ?', args: [scheduleId] });
    const target = targetResult.rows[0];
    if (!target) return res.status(404).json({ error: 'Schedule not found' });

    const wasActive = target.is_active === 1 || target.is_active === true;
    const weekKey = target.week_key;

    const tx = await db.transaction('write');
    try {
      await tx.execute({ sql: 'DELETE FROM schedule_shifts WHERE schedule_id = ?', args: [scheduleId] });
      await tx.execute({ sql: 'DELETE FROM schedules WHERE id = ?', args: [scheduleId] });

      if (wasActive) {
        const previousResult = await tx.execute({
          sql: `
            SELECT id FROM schedules
            WHERE week_key = ?
            ORDER BY id DESC
            LIMIT 1
          `,
          args: [weekKey]
        });
        const previous = previousResult.rows[0];
        if (previous) {
          await tx.execute({ sql: 'UPDATE schedules SET is_active = 1 WHERE id = ?', args: [previous.id] });
        }
      }

      await tx.execute({
        sql: 'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
        args: [
          adminId,
          'Delete Schedule',
          JSON.stringify({ id: scheduleId, week: weekKey, wasActive })
        ]
      });
      await tx.commit();
    } catch (e) {
      await tx.rollback();
      throw e;
    }

    res.json({ success: true, message: 'Schedule deleted' });
  } catch (e) {
    console.error('Delete schedule error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/admin/schedule/download/:id - AUTH via query token or header
router.get('/admin/schedule/download/:id', [
  param('id').isInt().toInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  // Support auth via query string for download links opened in new tabs
  const token = req.query.token || (req.headers['authorization'] || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  const jwt = require('jsonwebtoken');
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch(e) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  const db = req.app.locals.db;
  
  try {
    const scheduleResult = await db.execute({ sql: 'SELECT * FROM schedules WHERE id = ?', args: [req.params.id] });
    const schedule = scheduleResult.rows[0];
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

    // Build an Excel file from the schedule data
    const shiftsResult = await db.execute({
      sql: `
        SELECT ss.day, ss.shift, e.name_ar, e.name_en, e.department
        FROM schedule_shifts ss
        JOIN employees e ON ss.employee_id = e.id
        WHERE ss.schedule_id = ?
      `,
      args: [schedule.id]
    });
    const shifts = shiftsResult.rows;

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Schedule ' + schedule.week_key);
    
    // Group shifts by employee
    const empMap = {};
    shifts.forEach(s => {
      const key = s.name_ar;
      if (!empMap[key]) empMap[key] = { name_ar: s.name_ar, name_en: s.name_en, department: s.department, shifts: {} };
      empMap[key].shifts[s.day] = s.shift;
    });

    sheet.columns = [
      { header: 'Name', key: 'name_ar', width: 25 },
      { header: 'Department', key: 'department', width: 15 },
      { header: 'Saturday', key: 'Saturday', width: 12 },
      { header: 'Sunday', key: 'Sunday', width: 12 },
      { header: 'Monday', key: 'Monday', width: 12 },
      { header: 'Tuesday', key: 'Tuesday', width: 12 },
      { header: 'Wednesday', key: 'Wednesday', width: 12 },
      { header: 'Thursday', key: 'Thursday', width: 12 },
      { header: 'Friday', key: 'Friday', width: 12 },
    ];

    Object.values(empMap).forEach(emp => {
      sheet.addRow({
        name_ar: emp.name_ar,
        department: emp.department,
        ...emp.shifts
      });
    });

    const filename = `schedule_${schedule.week_key}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error('Download error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
