import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Execute migrations
const migrationsPath = path.join(__dirname, 'migrations.sql');
if (fs.existsSync(migrationsPath)) {
  const migrations = fs.readFileSync(migrationsPath, 'utf8');
  db.exec(migrations);
  console.log('✅ Database migrations executed');
}

// Add new columns to existing tables if they don't exist
// This handles schema updates for existing databases
function addColumnIfNotExists(tableName: string, columnName: string, columnDefinition: string) {
  try {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
    const columnExists = columns.some((col: any) => col.name === columnName);
    
    if (!columnExists) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
      console.log(`✅ Added column ${columnName} to ${tableName}`);
    }
  } catch (e: any) {
    console.error(`Error adding column ${columnName} to ${tableName}:`, e.message);
  }
}

// Add monthly_limit and limit_enabled to users table
addColumnIfNotExists('users', 'monthly_limit', 'REAL');
addColumnIfNotExists('users', 'limit_enabled', 'INTEGER NOT NULL DEFAULT 0');

// Seed development data only in development mode
if (process.env.NODE_ENV === 'development') {
  console.log('\n⚠️  DEVELOPMENT MODE - Seeding test data');
  
  // Seed admin user (DEVELOPMENT ONLY)
  const adminMatricula = 'admin';
  const adminName = 'System Administrator';
  const adminPassword = 'admin123';
  const pwHash = bcrypt.hashSync(adminPassword, 10);

  try {
    const exists = db.prepare('SELECT * FROM users WHERE matricula = ?').get(adminMatricula);
    if (!exists) {
      db.prepare('INSERT INTO users (full_name, matricula, password_hash, role) VALUES (?, ?, ?, ?)')
        .run(adminName, adminMatricula, pwHash, 'admin');
      console.log('✅ Default admin user created (DEVELOPMENT ONLY):');
      console.log('   Matricula: admin');
      console.log('   Password: admin123');
      console.log('   ⚠️  WARNING: This is a test account. DO NOT use in production!');
    }
  } catch (e: any) {
    console.error('Error seeding admin:', e.message);
  }

  // Seed sample sectors (DEVELOPMENT ONLY)
  const sampleSectors = ['FoodStation', 'Electronics', 'Office Supplies', 'Furniture', 'Tools'];
  for (const sectorName of sampleSectors) {
    try {
      const exists = db.prepare('SELECT * FROM sectors WHERE name = ?').get(sectorName);
      if (!exists) {
        db.prepare('INSERT INTO sectors (name) VALUES (?)').run(sectorName);
      }
    } catch (e: any) {
      // Sector already exists or other error, continue
    }
  }
  console.log('✅ Sample sectors created\n');
} else {
  console.log('\n📦 PRODUCTION MODE');
  console.log('⚠️  No default users created. Please create an admin user manually.');
  console.log('   Use the admin panel or create directly in the database.\n');
}

export default db;
