require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const cron = require('node-cron');
const crypto = require('crypto');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('WARNING: JWT_SECRET is not set. Using a temporary development secret; sessions will expire when the server restarts.');
}

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"]
    }
  }
}));

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
  origin: function (origin, callback) {
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
const dbUrl = process.env.TURSO_DATABASE_URL || 'file:./triumph_laundry.db';
const dbAuthToken = process.env.TURSO_AUTH_TOKEN || '';

const db = createClient({
  url: dbUrl,
  authToken: dbAuthToken
});

// Expose DB to routes
app.locals.db = db;

// Run migrations
const runMigrations = require('./db/migrate');

runMigrations(db).then(async () => {
  // Seed admin if none exists
  const adminCount = await db.execute('SELECT COUNT(*) as count FROM admins');
  if (adminCount.rows[0].count === 0) {
    const defaultUser = process.env.ADMIN_USERNAME || 'admin';
    let defaultPass = process.env.ADMIN_PASSWORD;

    if (!defaultPass || defaultPass === 'admin123' || defaultPass === 'change_this_password_immediately') {
      defaultPass = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
      console.warn('\n======================================================');
      console.warn('WARNING: No secure ADMIN_PASSWORD provided in .env');
      console.warn(`A random password has been generated: ${defaultPass}`);
      console.warn('Please login and change this immediately!');
      console.warn('======================================================\n');
    } else {
      console.log(`Default admin seeded. Username: ${defaultUser} (Please change password immediately if not secure)`);
    }

    const salt = bcrypt.genSaltSync(12);
    const hash = bcrypt.hashSync(defaultPass, salt);

    await db.execute({
      sql: 'INSERT INTO admins (username, password_hash) VALUES (?, ?)',
      args: [defaultUser, hash]
    });
  }
}).catch(err => {
  console.error('Migration failed:', err);
});

// Daily database backup at 2 AM
cron.schedule('0 2 * * *', () => {
  // SQLite local backups only work if we have a local file.
  // With Turso, backups are handled on their cloud.
  // This is kept here just as a placeholder or we can remove it.
  console.log('Daily database backup: handled by Turso or Cloud Provider');
});

// Routes
const authRoutes = require('./routes/auth');
const scheduleRoutes = require('./routes/schedule');
const contentRoutes = require('./routes/content');
const staffRoutes = require('./routes/staff');
const auditRoutes = require('./routes/audit');
const adminsRoutes = require('./routes/admins');
const dataFilesRoutes = require('./routes/data-files');

// Serve the admin entry without relying on a trailing-slash redirect.
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/index.html'));
});

app.use(express.static(path.join(__dirname, '../'), { dotfiles: 'deny' }));


app.use('/api/admin/login', loginLimiter, authRoutes);
app.use('/api', scheduleRoutes); // Note: schedule includes both public GET and protected POST
app.use('/api/admin/content', contentRoutes);
app.use('/api/admin/data', dataFilesRoutes);
app.use('/api/admin/staff', staffRoutes);
app.use('/api/admin/audit', auditRoutes);
app.use('/api/admin/admins', adminsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke on the server!' });
});

// Start server or export for Serverless
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
