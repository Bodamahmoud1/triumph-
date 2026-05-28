const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authenticateToken = require('../middleware/auth');
const { parseScheduleExcel } = require('../utils/excel');
const { body, query, param, validationResult } = require('express-validator');

// Multer setup for temporary Excel uploads
const isVercel = process.env.VERCEL === '1';
const uploadDir = isVercel ? '/tmp/uploads' : path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Strictly accept only xlsx
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.originalname.match(/\.xlsx$/)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx format allowed!'), false);
    }
  }
});

// Helper to cleanup old previews from DB and filesystem
function cleanupPreviews(db) {
  const oldPreviews = db.prepare("SELECT * FROM schedule_previews WHERE created_at < datetime('now', '-1 hour')").all();
  for (const p of oldPreviews) {
    try { fs.unlinkSync(p.file_path); } catch(e){}
  }
  db.prepare("DELETE FROM schedule_previews WHERE created_at < datetime('now', '-1 hour')").run();
}

// GET /api/schedule - PUBLIC (No Auth)
router.get('/schedule', [
  query('week').optional().trim().escape()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const db = req.app.locals.db;
  let weekKey = req.query.week;

  let scheduleRow;
  if (weekKey) {
    scheduleRow = db.prepare('SELECT * FROM schedules WHERE week_key = ? AND is_active = 1 ORDER BY id DESC LIMIT 1').get(weekKey);
  } else {
    scheduleRow = db.prepare('SELECT * FROM schedules WHERE is_active = 1 ORDER BY id DESC LIMIT 1').get();
  }

  if (!scheduleRow) {
    return res.json({ data: null, message: 'لا يوجد جدول منشور لهذا الأسبوع' });
  }

  const shifts = db.prepare(`
    SELECT ss.day, ss.shift, e.id, e.name_ar, e.name_en, e.department, e.employee_id
    FROM schedule_shifts ss
    JOIN employees e ON ss.employee_id = e.id
    WHERE ss.schedule_id = ?
    ORDER BY ss.id ASC
  `).all(scheduleRow.id);

  const employeesMap = new Map();
  shifts.forEach(row => {
    const key = String(row.id);
    if (!employeesMap.has(key)) {
      employeesMap.set(key, {
        name_ar: row.name_ar,
        name_en: row.name_en,
        employee_id: row.employee_id,
        department: row.department,
        job: row.department,
        shifts: {}
      });
    }
    employeesMap.get(key).shifts[row.day] = row.shift;
  });

  res.json({
    data: {
      week_key: scheduleRow.week_key,
      week_start: scheduleRow.week_start,
      employees: Array.from(employeesMap.values())
    }
  });
});

// POST /api/admin/schedule/upload - AUTH REQUIRED
router.post('/admin/schedule/upload', authenticateToken, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const db = req.app.locals.db;

    try {
      const parseResult = await parseScheduleExcel(req.file.path);

      const previewId = Date.now().toString() + Math.floor(Math.random()*1000);

      db.prepare('INSERT INTO schedule_previews (id, file_path, original_name, data_json) VALUES (?, ?, ?, ?)')
        .run(previewId, req.file.path, req.file.originalname, JSON.stringify({ weeks: parseResult.weeks, data: parseResult.data }));

      cleanupPreviews(db);

      res.json({
        previewId,
        valid: parseResult.valid,
        errors: parseResult.errors,
        previewData: parseResult.data,
        weeks: parseResult.weeks
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Error parsing Excel file' });
    }
  });
});

// POST /api/admin/schedule/publish - AUTH REQUIRED
router.post('/admin/schedule/publish', authenticateToken, [
  body('previewId').trim().notEmpty().withMessage('Preview ID required'),
  body('week_key').optional().trim(),
  body('week_start').optional().trim()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { previewId, week_key, week_start } = req.body;
  const db = req.app.locals.db;
  const adminId = req.user.id;

  const previewRecord = db.prepare('SELECT * FROM schedule_previews WHERE id = ?').get(previewId);

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

  if (!weeksToPublish.length || weeksToPublish.every((week) => !week.rows || week.rows.length === 0)) {
    return res.status(400).json({ error: 'Schedule preview is empty' });
  }

  try {
    const insertTransaction = db.transaction(() => {
      const insertEmp = db.prepare('INSERT INTO employees (name_ar, employee_id, department) VALUES (?, ?, ?)');
      const updateEmp = db.prepare('UPDATE employees SET name_ar = ?, department = ? WHERE id = ?');
      const getEmpByCode = db.prepare('SELECT id FROM employees WHERE employee_id = ?');
      const getEmpByName = db.prepare(`SELECT id FROM employees WHERE name_ar = ? AND (employee_id IS NULL OR employee_id = '')`);
      const insertShift = db.prepare('INSERT INTO schedule_shifts (schedule_id, employee_id, day, shift) VALUES (?, ?, ?, ?)');

      for (const week of weeksToPublish) {
        const resolvedWeekKey = week.week_key || week_key;
        const resolvedWeekStart = week.week_start || week_start || resolvedWeekKey;

        if (!resolvedWeekKey || !resolvedWeekStart) {
          throw new Error('Week key/start could not be determined from the uploaded file');
        }

        // 1. Deactivate existing schedules for this week
        db.prepare('UPDATE schedules SET is_active = 0 WHERE week_key = ?').run(resolvedWeekKey);

        // 2. Insert new schedule
        const schedResult = db.prepare(`
          INSERT INTO schedules (week_key, week_start, published_by, is_active, original_filename)
          VALUES (?, ?, ?, 1, ?)
        `).run(resolvedWeekKey, resolvedWeekStart, adminId, previewRecord.original_name);

        const newSchedId = schedResult.lastInsertRowid;

        // 3. Process employees and shifts
        for (const row of week.rows || []) {
          let empId;
          const employeeCode = row.employeeId || row.employee_id || null;
          const existingEmp = employeeCode ? getEmpByCode.get(employeeCode) : getEmpByName.get(row.name);

          if (existingEmp) {
            empId = existingEmp.id;
            updateEmp.run(row.name, row.department, empId);
          } else {
            const empResult = insertEmp.run(row.name, employeeCode, row.department);
            empId = empResult.lastInsertRowid;
          }

          for (const [day, shiftVal] of Object.entries(row.shifts || {})) {
            insertShift.run(newSchedId, empId, day, shiftVal);
          }
        }

        // 4. Log Audit
        db.prepare('INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)')
          .run(adminId, 'Publish Schedule', JSON.stringify({ week: resolvedWeekKey, rows: (week.rows || []).length }));
      }
    });

    insertTransaction();

    // Cleanup preview
    db.prepare('DELETE FROM schedule_previews WHERE id = ?').run(previewId);
    try { fs.unlinkSync(previewRecord.file_path); } catch(e){}

    res.json({ success: true, message: 'Schedule published successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error during publish' });
  }
});

// GET /api/admin/schedule/history - AUTH REQUIRED
router.get('/admin/schedule/history', authenticateToken, [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const db = req.app.locals.db;
  const page = req.query.page || 1;
  const limit = req.query.limit || 10;
  const offset = (page - 1) * limit;

  const total = db.prepare('SELECT COUNT(*) as total FROM schedules').get().total;

  const history = db.prepare(`
    SELECT s.id, s.week_key, s.published_at, s.is_active, s.original_filename, a.username as publisher
    FROM schedules s
    LEFT JOIN admins a ON s.published_by = a.id
    ORDER BY s.id DESC LIMIT ? OFFSET ?
  `).all(limit, offset);

  res.json({
    data: history,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
});

// POST /api/admin/schedule/restore/:id - AUTH REQUIRED
router.post('/admin/schedule/restore/:id', authenticateToken, [
  param('id').isInt().toInt()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const db = req.app.locals.db;
  const idToRestore = req.params.id;
  const adminId = req.user.id;

  const targetSched = db.prepare('SELECT * FROM schedules WHERE id = ?').get(idToRestore);
  if (!targetSched) return res.status(404).json({ error: 'Schedule not found' });

  try {
    const restoreTx = db.transaction(() => {
      db.prepare('UPDATE schedules SET is_active = 0 WHERE week_key = ?').run(targetSched.week_key);
      db.prepare('UPDATE schedules SET is_active = 1 WHERE id = ?').run(idToRestore);

      db.prepare('INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)')
        .run(adminId, 'Restore Schedule', JSON.stringify({ week: targetSched.week_key, id: idToRestore }));
    });
    restoreTx();
    res.json({ success: true, message: 'Schedule restored' });
  } catch(e) {
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/admin/schedule/download/:id - AUTH via query token or header
router.get('/admin/schedule/download/:id', [
  param('id').isInt().toInt()
], (req, res) => {
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
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(req.params.id);
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

  // Build an Excel file from the schedule data
  const shifts = db.prepare(`
    SELECT ss.day, ss.shift, e.name_ar, e.name_en, e.department
    FROM schedule_shifts ss
    JOIN employees e ON ss.employee_id = e.id
    WHERE ss.schedule_id = ?
  `).all(schedule.id);

  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Schedule ' + schedule.week_key);

  // Group shifts by employee
  const empMap = {};
  shifts.forEach(s => {
    const key = s.name_ar;
    if (!empMap[key]) empMap[key] = { name_ar: s.name_ar, name_en: s.name_en, department: s.department, job: s.department, shifts: {} };
    empMap[key].shifts[s.day] = s.shift;
  });

  sheet.columns = [
    { header: 'Name', key: 'name_ar', width: 25 },
    { header: 'Job', key: 'department', width: 15 },
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
  workbook.xlsx.write(res).then(() => res.end());
});

module.exports = router;
