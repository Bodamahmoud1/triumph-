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
        SELECT ss.day, ss.shift, e.name_ar, e.name_en, e.department, e.employee_id 
        FROM schedule_shifts ss
        JOIN employees e ON ss.employee_id = e.id
        WHERE ss.schedule_id = ?
      `,
      args: [scheduleRow.id]
    });

    const employeesMap = {};
    shiftsResult.rows.forEach(row => {
      const key = row.employee_id || row.name_ar;
      if (!employeesMap[key]) {
        employeesMap[key] = {
          name_ar: row.name_ar,
          name_en: row.name_en,
          department: row.department,
          shifts: {}
        };
      }
      employeesMap[key].shifts[row.day] = row.shift;
    });

    res.json({
      data: {
        week_key: scheduleRow.week_key,
        week_start: scheduleRow.week_start,
        employees: Object.values(employeesMap)
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
      const parseResult = await parseScheduleExcel(req.file.path);
      
      const previewId = Date.now().toString() + Math.floor(Math.random()*1000);
      
      await db.execute({
        sql: 'INSERT INTO schedule_previews (id, file_path, original_name, data_json) VALUES (?, ?, ?, ?)',
        args: [previewId, req.file.path, req.file.originalname, JSON.stringify(parseResult.data)]
      });

      cleanupPreviews(db); // Fire and forget async cleanup

      res.json({
        previewId,
        valid: parseResult.valid,
        errors: parseResult.errors,
        // Send a preview of the first week to the UI
        previewData: parseResult.data[0] ? parseResult.data[0].scheduleData.slice(0, 5) : [] 
      });
    } catch (e) {
      console.error('Upload error:', e);
      res.status(500).json({ error: 'Error parsing Excel file' });
    }
  });
});

// POST /api/admin/schedule/publish - AUTH REQUIRED
router.post('/admin/schedule/publish', authenticateToken, [
  body('previewId').trim().notEmpty().withMessage('Preview ID required'),
  body('week_key').trim().notEmpty().withMessage('Week key required'),
  body('week_start').trim().notEmpty().withMessage('Week start required')
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

    const scheduleDataArray = JSON.parse(previewRecord.data_json);

    const tx = await db.transaction('write');
    try {
      let insertedCount = 0;
      
      // We expect scheduleDataArray to be an array of 2 weeks: [{ week_start, scheduleData }, ...]
      for (let i = 0; i < scheduleDataArray.length; i++) {
        const weekObj = scheduleDataArray[i];
        if (!weekObj || !weekObj.scheduleData || weekObj.scheduleData.length === 0) continue;
        
        // Suffix the base week_key provided by the user
        const suffix = (scheduleDataArray.length > 1) ? ` - W${i + 1}` : '';
        const currentWeekKey = week_key + suffix;
        const currentWeekStart = weekObj.week_start || week_start;

        // 1. Deactivate existing schedules for this week
        await tx.execute({ sql: 'UPDATE schedules SET is_active = 0 WHERE week_key = ?', args: [currentWeekKey] });

        // 2. Insert new schedule
        const schedResult = await tx.execute({
          sql: `
            INSERT INTO schedules (week_key, week_start, published_by, is_active, original_filename) 
            VALUES (?, ?, ?, 1, ?)
          `,
          args: [currentWeekKey, currentWeekStart, adminId, previewRecord.original_name]
        });
        
        const newSchedId = Number(schedResult.lastInsertRowid);

        // 3. Process employees and shifts
        for (const row of weekObj.scheduleData) {
          let empId;
          const existingEmpResult = await tx.execute({ sql: 'SELECT id FROM employees WHERE name_ar = ?', args: [row.name] });
          const existingEmp = existingEmpResult.rows[0];
          
          if (existingEmp) {
            empId = existingEmp.id;
          } else {
            const empResult = await tx.execute({ sql: 'INSERT INTO employees (name_ar, department) VALUES (?, ?)', args: [row.name, row.department] });
            empId = Number(empResult.lastInsertRowid);
          }

          // Insert shifts
          for (const [day, shiftVal] of Object.entries(row.shifts)) {
            await tx.execute({
              sql: 'INSERT INTO schedule_shifts (schedule_id, employee_id, day, shift) VALUES (?, ?, ?, ?)',
              args: [newSchedId, empId, day, shiftVal]
            });
          }
          insertedCount++;
        }
      }

      // 4. Log Audit
      await tx.execute({
        sql: 'INSERT INTO audit_log (admin_id, action, details) VALUES (?, ?, ?)',
        args: [adminId, 'Publish Schedule', JSON.stringify({ base_week: week_key, total_rows: insertedCount })]
      });

      await tx.commit();
    } catch (e) {
      await tx.rollback();
      throw e;
    }

    // Cleanup preview
    await db.execute({ sql: 'DELETE FROM schedule_previews WHERE id = ?', args: [previewId] });
    try { fs.unlinkSync(previewRecord.file_path); } catch(e){}
    
    res.json({ success: true, message: 'Schedule published successfully' });
  } catch (e) {
    console.error('Publish error:', e);
    res.status(500).json({ error: 'Database error during publish' });
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
