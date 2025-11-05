CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  matricula TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  monthly_limit REAL,
  limit_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sectors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sector_id INTEGER,
  sku TEXT,
  unit_price REAL NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  total_in INTEGER NOT NULL DEFAULT 0,
  total_out INTEGER NOT NULL DEFAULT 0,
  photo_path TEXT,
  low_stock_threshold INTEGER DEFAULT 10,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(sector_id) REFERENCES sectors(id)
);

CREATE TABLE IF NOT EXISTS consumptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  qty INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  total_price REAL NOT NULL,
  consumed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS stock_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  change INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(product_id) REFERENCES products(id)
);

-- Add new columns to products table
ALTER TABLE products ADD COLUMN category TEXT;
ALTER TABLE products ADD COLUMN unit_measure TEXT;
ALTER TABLE products ADD COLUMN sale_price REAL;
ALTER TABLE products ADD COLUMN min_quantity INTEGER;
ALTER TABLE products ADD COLUMN max_quantity INTEGER;
ALTER TABLE products ADD COLUMN supplier TEXT;
ALTER TABLE products ADD COLUMN last_purchase_date TEXT;
ALTER TABLE products ADD COLUMN last_count_date TEXT;
ALTER TABLE products ADD COLUMN asset_number TEXT;
ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'Ativo';

-- Add new columns to stock_transactions table
ALTER TABLE stock_transactions ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE stock_transactions ADD COLUMN transaction_type TEXT;
