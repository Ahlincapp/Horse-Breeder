// Express backend for Horse Breeder app - Dual mode (PostgreSQL + JSON fallback)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Check which mode to use
const usePostgres = !!process.env.DATABASE_URL;

let pool;
let db = { users: [], mares: [], cycles: [], stallions: [], collections: [] };
const DB_FILE = path.join(__dirname, '..', 'database.json');

// Load JSON database
function loadJsonDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(data);
    }
  } catch (err) {
    console.log('Starting with empty database');
  }
}

function saveJsonDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Initialize database
async function initDb() {
  if (usePostgres) {
    const { Pool } = require('pg');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS mares (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          name VARCHAR(255) NOT NULL,
          birth_date DATE,
          created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS cycles (
          id SERIAL PRIMARY KEY,
          mare_id INTEGER REFERENCES mares(id),
          start_date DATE,
          end_date DATE,
          created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS stallions (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          breed VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS collections (
          id SERIAL PRIMARY KEY,
          stallion_id INTEGER REFERENCES stallions(id),
          mare_id INTEGER REFERENCES mares(id),
          cycle_id INTEGER REFERENCES cycles(id),
          date DATE,
          method VARCHAR(50),
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
      console.log('✅ PostgreSQL database initialized');
    } finally {
      client.release();
    }
  } else {
    loadJsonDb();
    console.log('✅ JSON file database initialized');
  }
}

initDb();

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
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });

  try {
    if (usePostgres) {
      const hashed = bcrypt.hashSync(password, 10);
      const result = await pool.query(
        'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
        [name, email, hashed]
      );
      const user = result.rows[0];
      const token = generateToken(user);
      res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } else {
      // JSON mode
      if (db.users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'Email already used' });
      }
      const hashed = bcrypt.hashSync(password, 10);
      const user = { id: Date.now(), name, email, password: hashed, created_at: new Date().toISOString() };
      db.users.push(user);
      saveJsonDb();
      const token = generateToken({ id: user.id, name: user.name, email: user.email });
      res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    }
  } catch (err) {
    if (err.code === '23505') {
      res.status(400).json({ error: 'Email already used' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

  try {
    if (usePostgres) {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      const user = result.rows[0];
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      if (!bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = generateToken(user);
      res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } else {
      // JSON mode
      const user = db.users.find(u => u.email === email);
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      if (!bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = generateToken({ id: user.id, name: user.name, email: user.email });
      res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Mare routes (protected) ----------
app.get('/api/mares', authMiddleware, async (req, res) => {
  try {
    if (usePostgres) {
      const result = await pool.query('SELECT * FROM mares WHERE user_id = $1', [req.user.id]);
      res.json(result.rows.map(m => ({ id: m.id, userId: m.user_id, name: m.name, birthDate: m.birth_date })));
    } else {
      const mares = db.mares.filter(m => m.userId === req.user.id);
      res.json(mares);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/mares', authMiddleware, async (req, res) => {
  const { name, birthDate, lastBred } = req.body;
  try {
    if (usePostgres) {
      const result = await pool.query(
        'INSERT INTO mares (user_id, name, birth_date, last_bred) VALUES ($1, $2, $3, $4) RETURNING *',
        [req.user.id, name, birthDate, lastBred || null]
      );
      const mare = result.rows[0];
      res.json({ id: mare.id, userId: mare.user_id, name: mare.name, birthDate: mare.birth_date, lastBred: mare.last_bred });
    } else {
      const mare = { id: Date.now(), userId: req.user.id, name, birthDate, lastBred: lastBred || null, created_at: new Date().toISOString() };
      db.mares.push(mare);
      saveJsonDb();
      res.json(mare);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/mares/:mareId', authMiddleware, async (req, res) => {
  const { mareId } = req.params;
  const { name, birthDate, lastBred } = req.body;
  try {
    if (usePostgres) {
      const result = await pool.query(
        'UPDATE mares SET name = $1, birth_date = $2, last_bred = $3 WHERE id = $4 RETURNING *',
        [name, birthDate, lastBred || null, mareId]
      );
      const mare = result.rows[0];
      res.json({ id: mare.id, userId: mare.user_id, name: mare.name, birthDate: mare.birth_date, lastBred: mare.last_bred });
    } else {
      const idx = db.mares.findIndex(m => m.id === parseInt(mareId));
      if (idx === -1) return res.status(404).json({ error: 'Mare not found' });
      db.mares[idx] = { ...db.mares[idx], name, birthDate, lastBred: lastBred || null };
      saveJsonDb();
      res.json(db.mares[idx]);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/mares/:mareId', authMiddleware, async (req, res) => {
  const { mareId } = req.params;
  try {
    if (usePostgres) {
      await pool.query('DELETE FROM mares WHERE id = $1', [mareId]);
    } else {
      db.mares = db.mares.filter(m => m.id !== parseInt(mareId));
      saveJsonDb();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Cycle routes (protected) ----------
app.get('/api/mares/:mareId/cycles', authMiddleware, async (req, res) => {
  const { mareId } = req.params;
  try {
    if (usePostgres) {
      const result = await pool.query('SELECT * FROM cycles WHERE mare_id = $1', [mareId]);
      res.json(result.rows.map(c => ({ id: c.id, mareId: c.mare_id, startDate: c.start_date, endDate: c.end_date })));
    } else {
      const cycles = db.cycles.filter(c => c.mareId === parseInt(mareId));
      res.json(cycles);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/mares/:mareId/cycles', authMiddleware, async (req, res) => {
  const { mareId } = req.params;
  const { startDate, endDate } = req.body;
  try {
    if (usePostgres) {
      const result = await pool.query(
        'INSERT INTO cycles (mare_id, start_date, end_date) VALUES ($1, $2, $3) RETURNING *',
        [mareId, startDate, endDate]
      );
      const cycle = result.rows[0];
      res.json({ id: cycle.id, mareId: cycle.mare_id, startDate: cycle.start_date, endDate: cycle.end_date });
    } else {
      const cycle = { id: Date.now(), mareId: parseInt(mareId), startDate, endDate, created_at: new Date().toISOString() };
      db.cycles.push(cycle);
      saveJsonDb();
      res.json(cycle);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Stallion routes (protected) ----------
app.post('/api/stallions', authMiddleware, async (req, res) => {
  const { name, breed } = req.body;
  try {
    if (usePostgres) {
      const result = await pool.query(
        'INSERT INTO stallions (name, breed) VALUES ($1, $2) RETURNING *',
        [name, breed]
      );
      res.json({ id: result.rows[0].id, name: result.rows[0].name, breed: result.rows[0].breed });
    } else {
      const stallion = { id: Date.now(), name, breed, created_at: new Date().toISOString() };
      db.stallions.push(stallion);
      saveJsonDb();
      res.json(stallion);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stallions', authMiddleware, async (req, res) => {
  try {
    if (usePostgres) {
      const result = await pool.query('SELECT * FROM stallions');
      res.json(result.rows.map(s => ({ id: s.id, name: s.name, breed: s.breed })));
    } else {
      res.json(db.stallions);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/stallions/:stallionId', authMiddleware, async (req, res) => {
  const { stallionId } = req.params;
  const { name, breed } = req.body;
  try {
    if (usePostgres) {
      const result = await pool.query(
        'UPDATE stallions SET name = $1, breed = $2 WHERE id = $3 RETURNING *',
        [name, breed || null, stallionId]
      );
      const s = result.rows[0];
      res.json({ id: s.id, name: s.name, breed: s.breed });
    } else {
      const idx = db.stallions.findIndex(s => s.id === parseInt(stallionId));
      if (idx === -1) return res.status(404).json({ error: 'Stallion not found' });
      db.stallions[idx] = { ...db.stallions[idx], name, breed: breed || null };
      saveJsonDb();
      res.json(db.stallions[idx]);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/stallions/:stallionId', authMiddleware, async (req, res) => {
  const { stallionId } = req.params;
  try {
    if (usePostgres) {
      await pool.query('DELETE FROM stallions WHERE id = $1', [stallionId]);
    } else {
      db.stallions = db.stallions.filter(s => s.id !== parseInt(stallionId));
      saveJsonDb();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/collections', authMiddleware, async (req, res) => {
  const { stallionId, mareId, cycleId, date, method } = req.body;
  try {
    if (usePostgres) {
      const result = await pool.query(
        'INSERT INTO collections (stallion_id, mare_id, cycle_id, date, method) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [stallionId, mareId, cycleId, date, method]
      );
      const c = result.rows[0];
      res.json({ id: c.id, stallionId: c.stallion_id, mareId: c.mare_id, cycleId: c.cycle_id, date: c.date, method: c.method });
    } else {
      const c = { id: Date.now(), stallionId, mareId, cycleId, date, method, created_at: new Date().toISOString() };
      db.collections.push(c);
      saveJsonDb();
      res.json(c);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stallions/:id/report', authMiddleware, async (req, res) => {
  const stallionId = req.params.id;
  try {
    if (usePostgres) {
      const result = await pool.query('SELECT * FROM collections WHERE stallion_id = $1', [stallionId]);
      res.json({ stallionId, collections: result.rows });
    } else {
      const collections = db.collections.filter(c => c.stallionId === parseInt(stallionId));
      res.json({ stallionId, collections });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Seed route ----------
app.get('/api/seed', async (req, res) => {
  try {
    if (usePostgres) {
      const existing = await pool.query('SELECT id FROM users LIMIT 1');
      if (existing.rows.length > 0) {
        return res.json({ message: 'User already exists' });
      }
      const hashed = bcrypt.hashSync('horse2026', 10);
      await pool.query('INSERT INTO users (name, email, password) VALUES ($1, $2, $3)', ['Admin', 'admin@horse.com', hashed]);
      res.json({ message: 'Default user created', email: 'admin@horse.com', password: 'horse2026' });
    } else {
      if (db.users.length > 0) {
        return res.json({ message: 'User already exists' });
      }
      const hashed = bcrypt.hashSync('horse2026', 10);
      db.users.push({ id: Date.now(), name: 'Admin', email: 'admin@horse.com', password: hashed, created_at: new Date().toISOString() });
      saveJsonDb();
      res.json({ message: 'Default user created', email: 'admin@horse.com', password: 'horse2026' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Health & Static ----------
app.get('/api/health', (req, res) => res.json({ status: 'ok', mode: usePostgres ? 'postgres' : 'json' }));

// Serve React static files
const clientPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientPath));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientPath, 'index.html'));
  }
});

// Start server
const PORT = process.env.PORT || 4002;
app.listen(PORT, () => console.log(`🚀 Server listening on http://localhost:${PORT} (${usePostgres ? 'PostgreSQL' : 'JSON file'} mode)`));