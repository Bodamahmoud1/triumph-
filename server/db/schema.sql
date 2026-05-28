CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  employee_id TEXT UNIQUE,
  department TEXT NOT NULL,
  phone TEXT,
  status TEXT DEFAULT 'Active',
  is_deleted BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_key TEXT NOT NULL,
  week_start DATE NOT NULL,
  published_by INTEGER,
  published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT 0,
  original_filename TEXT,
  FOREIGN KEY(published_by) REFERENCES admins(id)
);

CREATE TABLE IF NOT EXISTS schedule_shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  shift TEXT NOT NULL,
  FOREIGN KEY(schedule_id) REFERENCES schedules(id),
  FOREIGN KEY(employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section TEXT NOT NULL,
  field_key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(section, field_key)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER,
  action TEXT NOT NULL,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(admin_id) REFERENCES admins(id)
);

CREATE INDEX IF NOT EXISTS idx_schedule_shifts_schedule_id ON schedule_shifts(schedule_id);
CREATE INDEX IF NOT EXISTS idx_employees_name_ar ON employees(name_ar);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  refresh_token TEXT NOT NULL,
  token_family TEXT,
  replaced_by INTEGER,
  revoked_reason TEXT,
  user_agent TEXT,
  ip_address TEXT,
  last_used_at DATETIME,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_revoked BOOLEAN DEFAULT 0,
  FOREIGN KEY(admin_id) REFERENCES admins(id),
  FOREIGN KEY(replaced_by) REFERENCES sessions(id)
);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_admin_id ON sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_family ON sessions(token_family);

CREATE TABLE IF NOT EXISTS schedule_previews (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  original_name TEXT NOT NULL,
  data_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS catalogue_data (
  kind TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_by INTEGER,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(updated_by) REFERENCES admins(id)
);
CREATE INDEX IF NOT EXISTS idx_catalogue_data_updated_at ON catalogue_data(updated_at);
