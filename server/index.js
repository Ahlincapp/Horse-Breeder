// Simple Express backend for Horse Breeder app
const path = require('path');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

let db;

// Initialize SQL.js database
async function initDb() {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  
  // Try to load existing database
  const dbPath = path.join(__dirname, '..', 'horsebreeder.db');
  let data = null;
  if (fs.existsSync(dbPath)) {
    data = fs.readFileSync(dbPath);
  }
  
  db = new SQL.Database(data ? new Uint8Array(data) : undefined);
  
  // Create tables if they don't exist
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      name TEXT,
      birthDate TEXT,
      FOREIGN KEY(userId) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS cycles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mareId INTEGER,
      startDate TEXT,
      endDate TEXT,
      FOREIGN KEY(mareId) REFERENCES mares(id)
    );
    CREATE TABLE IF NOT EXISTS stallions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      breed TEXT
    );
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stallionId INTEGER,
      mareId INTEGER,
      cycleId INTEGER,
      date TEXT,
      method TEXT,
      FOREIGN KEY(stallionId) REFERENCES stallions(id),
      FOREIGN KEY(mareId) REFERENCES mares(id),
      FOREIGN KEY(cycleId) REFERENCES cycles(id)
    );
  `);
  
  // Save to file
  saveDb();
  console.log('✅ Database initialized');
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(path.join(__dirname, '..', 'horsebreeder.db'), buffer);
}

// Helper: generate JWT
function generateToken(user) {
  const payload = { id: user.id, name: user.name, email: user.email };
  return jwt.sign(payload, process.env.JWT_SECRET || 'defaultsecret', { expiresIn: '7d' });
}

// Middleware: protect routes
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing token' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'defaultsecret');
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ---------- Auth routes ----------
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  const hashed = bcrypt.hashSync(password, 10);
  try {
    db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hashed]);
    const lastId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
    saveDb();
    const user = { id: lastId, name, email };
    const token = generateToken(user);
    res.json({ token, user });
  } catch (err) {
    res.status(400).json({ error: 'Email already used' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  stmt.bind([email]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    if (!bcrypt.compareSync(password, row.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = generateToken(row);
    res.json({ token, user: { id: row.id, name: row.name, email: row.email } });
  } else {
    stmt.free();
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// ---------- Mare routes (protected) ----------
app.get('/api/mares', authMiddleware, (req, res) => {
  const stmt = db.prepare('SELECT * FROM mares WHERE userId = ?');
  stmt.bind([req.user.id]);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  res.json(rows);
});

app.post('/api/mares', authMiddleware, (req, res) => {
  const { name, birthDate } = req.body;
  db.run('INSERT INTO mares (userId, name, birthDate) VALUES (?, ?, ?)', [req.user.id, name, birthDate]);
  const lastId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  saveDb();
  res.json({ id: lastId, name, birthDate });
});

// ---------- Cycle routes (protected) ----------
app.get('/api/mares/:mareId/cycles', authMiddleware, (req, res) => {
  const { mareId } = req.params;
  const stmt = db.prepare('SELECT * FROM cycles WHERE mareId = ?');
  stmt.bind([mareId]);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  res.json(rows);
});

app.post('/api/mares/:mareId/cycles', authMiddleware, (req, res) => {
  const { mareId } = req.params;
  const { startDate, endDate } = req.body;
  db.run('INSERT INTO cycles (mareId, startDate, endDate) VALUES (?, ?, ?)', [mareId, startDate, endDate]);
  const lastId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  saveDb();
  res.json({ id: lastId, startDate, endDate });
});

// ---------- Stallion routes (protected) ----------
app.post('/api/stallions', authMiddleware, (req, res) => {
  const { name, breed } = req.body;
  db.run('INSERT INTO stallions (name, breed) VALUES (?, ?)', [name, breed]);
  const lastId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  saveDb();
  res.json({ id: lastId, name, breed });
});

app.get('/api/stallions', authMiddleware, (req, res) => {
  const stmt = db.prepare('SELECT * FROM stallions');
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  res.json(rows);
});

app.post('/api/collections', authMiddleware, (req, res) => {
  const { stallionId, mareId, cycleId, date, method } = req.body;
  db.run('INSERT INTO collections (stallionId, mareId, cycleId, date, method) VALUES (?, ?, ?, ?, ?)', [stallionId, mareId, cycleId, date, method]);
  const lastId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  saveDb();
  res.json({ id: lastId, stallionId, mareId, cycleId, date, method });
});

app.get('/api/stallions/:id/report', authMiddleware, (req, res) => {
  const stallionId = req.params.id;
  const stmt = db.prepare('SELECT * FROM collections WHERE stallionId = ?');
  stmt.bind([stallionId]);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  res.json({ stallionId, collections: rows });
});

// ---------- Seed route ----------
app.get('/api/seed', (req, res) => {
  const stmt = db.prepare('SELECT email FROM users LIMIT 1');
  if (stmt.step()) {
    stmt.free();
    return res.json({ message: 'User already exists' });
  }
  stmt.free();
  const hash = bcrypt.hashSync('horse2026', 10);
  db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', ['Admin', 'admin@horse.com', hash]);
  saveDb();
  res.json({ message: 'Default user created', email: 'admin@horse.com', password: 'horse2026' });
});

// ---------- Health & Static ----------
const clientPath = path.join(__dirname, '..', 'client', 'dist');
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve React static files
app.use(express.static(clientPath));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientPath, 'index.html'));
  }
});

// Start server
const PORT = process.env.PORT || 4002;

initDb().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server listening on http://localhost:${PORT}`));
}).catch(err => {
  console.error('Failed to init DB:', err);
  process.exit(1);
});