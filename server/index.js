// Simple Express backend for Horse Breeder app
const path = require('path');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(express.json());

// Initialise SQLite DB (file will be created automatically)
const db = new sqlite3.Database('horsebreeder.db');

// Create tables if they don't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );`);
  db.run(`CREATE TABLE IF NOT EXISTS mares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    name TEXT,
    birthDate TEXT,
    FOREIGN KEY(userId) REFERENCES users(id)
  );`);
  db.run(`CREATE TABLE IF NOT EXISTS cycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mareId INTEGER,
    startDate TEXT,
    endDate TEXT,
    FOREIGN KEY(mareId) REFERENCES mares(id)
  );`);
  db.run(`CREATE TABLE IF NOT EXISTS stallions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    breed TEXT
  );`);
  db.run(`CREATE TABLE IF NOT EXISTS collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stallionId INTEGER,
    mareId INTEGER,
    cycleId INTEGER,
    date TEXT,
    method TEXT,
    FOREIGN KEY(stallionId) REFERENCES stallions(id),
    FOREIGN KEY(mareId) REFERENCES mares(id),
    FOREIGN KEY(cycleId) REFERENCES cycles(id)
  );`);
});

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
  const stmt = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
  stmt.run(name, email, hashed, function (err) {
    if (err) return res.status(400).json({ error: 'Email already used' });
    const user = { id: this.lastID, name, email };
    const token = generateToken(user);
    res.json({ token, user });
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
    if (err || !row) return res.status(401).json({ error: 'Invalid credentials' });
    if (!bcrypt.compareSync(password, row.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = generateToken(row);
    res.json({ token, user: { id: row.id, name: row.name, email: row.email } });
  });
});

// ---------- Mare routes (protected) ----------
app.get('/api/mares', authMiddleware, (req, res) => {
  db.all('SELECT * FROM mares WHERE userId = ?', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/mares', authMiddleware, (req, res) => {
  const { name, birthDate } = req.body;
  const stmt = db.prepare('INSERT INTO mares (userId, name, birthDate) VALUES (?, ?, ?)');
  stmt.run(req.user.id, name, birthDate, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name, birthDate });
  });
});

// ---------- Cycle routes (protected) ----------
app.get('/api/mares/:mareId/cycles', authMiddleware, (req, res) => {
  const { mareId } = req.params;
  db.all('SELECT * FROM cycles WHERE mareId = ?', [mareId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/mares/:mareId/cycles', authMiddleware, (req, res) => {
  const { mareId } = req.params;
  const { startDate, endDate } = req.body;
  const stmt = db.prepare('INSERT INTO cycles (mareId, startDate, endDate) VALUES (?, ?, ?)');
  stmt.run(mareId, startDate, endDate, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, startDate, endDate });
  });
});

// ---------- Stallion routes (protected) ----------
// Create stallion
app.post('/api/stallions', authMiddleware, (req, res) => {
  const { name, breed } = req.body;
  const stmt = db.prepare('INSERT INTO stallions (name, breed) VALUES (?, ?)');
  stmt.run(name, breed, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name, breed });
  });
});

// List stallions
app.get('/api/stallions', authMiddleware, (req, res) => {
  db.all('SELECT * FROM stallions', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Add collection day (sync with mare cycle)
app.post('/api/collections', authMiddleware, (req, res) => {
  const { stallionId, mareId, cycleId, date, method } = req.body; // method: live|cooled|frozen
  const stmt = db.prepare('INSERT INTO collections (stallionId, mareId, cycleId, date, method) VALUES (?, ?, ?, ?, ?)');
  stmt.run(stallionId, mareId, cycleId, date, method, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, stallionId, mareId, cycleId, date, method });
  });
});

// Export stallion report (simple JSON list of collections)
app.get('/api/stallions/:id/report', authMiddleware, (req, res) => {
  const stallionId = req.params.id;
  db.all('SELECT * FROM collections WHERE stallionId = ?', [stallionId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ stallionId, collections: rows });
  });
});

// Health endpoint
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve React static files
// Serve the built React app regardless of environment
const clientPath = path.resolve(__dirname, '../client/dist');
console.log('📂 clientPath =', clientPath);
const fs = require('fs');
if (fs.existsSync(clientPath)) {
  console.log('✅ clientPath exists');
} else {
  console.log('❌ clientPath missing');
}
if (fs.existsSync(path.join(clientPath, 'index.html'))) {
  console.log('✅ index.html exists');
} else {
  console.log('❌ index.html missing');
}

// Force correct MIME types for JS and CSS assets
app.use((req, res, next) => {
  if (req.path.endsWith('.js')) {
    res.type('application/javascript');
  } else if (req.path.endsWith('.css')) {
    res.type('text/css');
  }
  next();
});

app.use(express.static(clientPath));

// Debug endpoint to verify the built JS bundle is reachable
app.get('/debug-bundle', (req, res) => {
  const bundlePath = path.join(clientPath, 'assets', 'index-C2_b4UH9.js');
  if (fs.existsSync(bundlePath)) {
    res.type('application/javascript');
    res.sendFile(bundlePath);
  } else {
    res.status(404).send('Bundle not found');
  }
});

// Seed default user (run once)
app.get('/api/seed', (req, res) => {
  db.get('SELECT email FROM users LIMIT 1', (err, row) => {
    if (row) return res.json({ message: 'User already exists' });
    const hash = bcrypt.hashSync('horse2026', 10);
    db.run('INSERT INTO users (email, password, name) VALUES (?, ?, ?)', ['admin@horse.com', hash, 'Admin'], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Default user created', email: 'admin@horse.com', password: 'horse2026' });
    });
  });
});

// Serve React app for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => console.log(`🚀 Server listening on http://localhost:${PORT}`));
// trigger redeploy
