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

const DB_FILE = path.join(__dirname, '..', 'database.json');

// Simple JSON database
let db = {
  users: [],
  mares: [],
  cycles: [],
  stallions: [],
  collections: []
};

// Load database from file
function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(data);
    }
  } catch (err) {
    console.log('Starting with empty database');
  }
}

// Save database to file
function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

loadDb();
console.log('✅ Database loaded');

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
  
  if (db.users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'Email already used' });
  }
  
  const hashed = bcrypt.hashSync(password, 10);
  const user = { id: Date.now(), name, email, password: hashed };
  db.users.push(user);
  saveDb();
  
  const token = generateToken(user);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
  
  const user = db.users.find(u => u.email === email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  
  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = generateToken(user);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

// ---------- Mare routes (protected) ----------
app.get('/api/mares', authMiddleware, (req, res) => {
  const mares = db.mares.filter(m => m.userId === req.user.id);
  res.json(mares);
});

app.post('/api/mares', authMiddleware, (req, res) => {
  const { name, birthDate } = req.body;
  const mare = { id: Date.now(), userId: req.user.id, name, birthDate };
  db.mares.push(mare);
  saveDb();
  res.json(mare);
});

// ---------- Cycle routes (protected) ----------
app.get('/api/mares/:mareId/cycles', authMiddleware, (req, res) => {
  const { mareId } = req.params;
  const cycles = db.cycles.filter(c => c.mareId === parseInt(mareId));
  res.json(cycles);
});

app.post('/api/mares/:mareId/cycles', authMiddleware, (req, res) => {
  const { mareId } = req.params;
  const { startDate, endDate } = req.body;
  const cycle = { id: Date.now(), mareId: parseInt(mareId), startDate, endDate };
  db.cycles.push(cycle);
  saveDb();
  res.json(cycle);
});

// ---------- Stallion routes (protected) ----------
app.post('/api/stallions', authMiddleware, (req, res) => {
  const { name, breed } = req.body;
  const stallion = { id: Date.now(), name, breed };
  db.stallions.push(stallion);
  saveDb();
  res.json(stallion);
});

app.get('/api/stallions', authMiddleware, (req, res) => {
  res.json(db.stallions);
});

app.post('/api/collections', authMiddleware, (req, res) => {
  const { stallionId, mareId, cycleId, date, method } = req.body;
  const collection = { id: Date.now(), stallionId, mareId, cycleId, date, method };
  db.collections.push(collection);
  saveDb();
  res.json(collection);
});

app.get('/api/stallions/:id/report', authMiddleware, (req, res) => {
  const stallionId = req.params.id;
  const collections = db.collections.filter(c => c.stallionId === parseInt(stallionId));
  res.json({ stallionId, collections });
});

// ---------- Seed route ----------
app.get('/api/seed', (req, res) => {
  if (db.users.length > 0) {
    return res.json({ message: 'User already exists' });
  }
  const hash = bcrypt.hashSync('horse2026', 10);
  const user = { id: Date.now(), name: 'Admin', email: 'admin@horse.com', password: hash };
  db.users.push(user);
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
app.listen(PORT, () => console.log(`🚀 Server listening on http://localhost:${PORT}`));