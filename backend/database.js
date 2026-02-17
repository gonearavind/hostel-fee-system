const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'hostel.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user',
    full_name TEXT,
    room_number TEXT,
    email TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Payments table
  db.run(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    month INTEGER,
    year INTEGER,
    amount REAL DEFAULT 500,
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'paid',
    payment_id TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Payment intents table (for online payments)
  db.run(`CREATE TABLE IF NOT EXISTS payment_intents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    month INTEGER,
    year INTEGER,
    amount REAL,
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Create default admin if not exists
  const defaultAdmin = {
    username: 'admin',
    password: bcrypt.hashSync('admin123', 10),
    role: 'admin',
    full_name: 'System Admin',
    room_number: 'A-001',
    email: 'admin@hostel.com',
    phone: '0000000000'
  };

  db.get('SELECT * FROM users WHERE username = ?', ['admin'], (err, row) => {
    if (!row) {
      db.run(
        'INSERT INTO users (username, password, role, full_name, room_number, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [defaultAdmin.username, defaultAdmin.password, defaultAdmin.role, defaultAdmin.full_name, defaultAdmin.room_number, defaultAdmin.email, defaultAdmin.phone]
      );
    }
  });
});

module.exports = db;