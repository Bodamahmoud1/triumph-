require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const cron = require('node-cron');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());

// HTTPS redirect in production
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect('https://' + req.headers.host + req.url);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, file://)
    if (!origin) return callback(null, true);
    // In production, restrict to your domain
    const allowed = [
      'https://triumph-laundry.vercel.app',
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
    ];
    const isAllowed = allowed.some(o => o instanceof RegExp ? o.test(origin) : o === origin);
    callback(null, isAllowed || process.env.NODE_ENV !== 'production');
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  credentials: true
}));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Rate limiting for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: { error: 'Too many login attempts from this IP, please try again after 15 minutes' }
});

// Initialize Database
const dbPath = process.env.DB_PATH || './triumph_laundry.db';
const db = new Database(dbPath, { verbose: console.log });

// Expose DB to routes
app.locals.db = db;

// Run migrations
const runMigrations = require('./db/migrate');
runMigrations(db);

// Seed admin if none exists
const adminCount = db.prepare('SELECT COUNT(*) as count FROM admins').get();
if (adminCount.count === 0) {
  const defaultUser = process.env.ADMIN_USERNAME || 'admin';
  const defaultPass = process.env.ADMIN_PASSWORD || Math.random().toString(36).slice(-10);
  const salt = bcrypt.genSaltSync(12);
  const hash = bcrypt.hashSync(defaultPass, salt);
  
  db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)')
    .run(defaultUser, hash);
  console.log(`Default admin seeded. Username: ${defaultUser}, Password: ${defaultPass} (Please change immediately)`);
}

// Daily database backup at 2 AM
cron.schedule('0 2 * * *', () => {
  const backupDir = path.join(__dirname, 'db', 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const dateStr = new Date().toISOString().split('T')[0];
  const backupPath = path.join(backupDir, `backup_${dateStr}.db`);
  db.backup(backupPath)
    .then(() => console.log(`Database backup successful: ${backupPath}`))
    .catch(err => console.error('Database backup failed:', err));
});

// Routes
const authRoutes = require('./routes/auth');
const scheduleRoutes = require('./routes/schedule');
const contentRoutes = require('./routes/content');
const staffRoutes = require('./routes/staff');
const auditRoutes = require('./routes/audit');

app.use(express.static(path.join(__dirname, '../')));


app.use('/api/admin/login', loginLimiter, authRoutes);
app.use('/api', scheduleRoutes); // Note: schedule includes both public GET and protected POST
app.use('/api/admin/content', contentRoutes);
app.use('/api/admin/staff', staffRoutes);
app.use('/api/admin/audit', auditRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke on the server!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
