CREATE TABLE IF NOT EXISTS catalogue_data (
  kind TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_by INTEGER,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(updated_by) REFERENCES admins(id)
);

CREATE INDEX IF NOT EXISTS idx_catalogue_data_updated_at ON catalogue_data(updated_at);
