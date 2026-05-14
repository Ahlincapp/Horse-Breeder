// Express backend for Horse Breeder app - PostgreSQL version
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Initialize database tables
async function initDb() {
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
    console.log('✅ Database tables initialized');
  } catch (err) {
    console.error('Database init error:', err.message);
  } finally {
    client.release();
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
    const hashed = bcrypt.hashSync(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hashed]
    );
    const user = result.rows[0];
    const token = generateToken(user);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
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
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = generateToken(user);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Mare routes (protected) ----------
app.get('/api/mares', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM mares WHERE user_id = $1', [req.user.id]);
    res.json(result.rows.map(m => ({ id: m.id, userId: m.user_id, name: m.name, birthDate: m.birth_date })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/mares', authMiddleware, async (req, res) => {
  const { name, birthDate } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO mares (user_id, name, birth_date) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, name, birthDate]
    );
    const mare = result.rows[0];
    res.json({ id: mare.id, userId: mare.user_id, name: mare.name, birthDate: mare.birth_date });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Cycle routes (protected) ----------
app.get('/api/mares/:mareId/cycles', authMiddleware, async (req, res) => {
  const { mareId } = req.params;
  try {
    const result = await pool.query('SELECT * FROM cycles WHERE mare_id = $1', [mareId]);
    res.json(result.rows.map(c => ({ id: c.id, mareId: c.mare_id, startDate: c.start_date, endDate: c.end_date })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/mares/:mareId/cycles', authMiddleware, async (req, res) => {
  const { mareId } = req.params;
  const { startDate, endDate } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO cycles (mare_id, start_date, end_date) VALUES ($1, $2, $3) RETURNING *',
      [mareId, startDate, endDate]
    );
    const cycle = result.rows[0];
    res.json({ id: cycle.id, mareId: cycle.mare_id, startDate: cycle.start_date, endDate: cycle.end_date });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Stallion routes (protected) ----------
app.post('/api/stallions', authMiddleware, async (req, res) => {
  const { name, breed } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO stallions (name, breed) VALUES ($1, $2) RETURNING *',
      [name, breed]
    );
    res.json({ id: result.rows[0].id, name: result.rows[0].name, breed: result.rows[0].breed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stallions', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM stallions');
    res.json(result.rows.map(s => ({ id: s.id, name: s.name, breed: s.breed })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/collections', authMiddleware, async (req, res) => {
  const { stallionId, mareId, cycleId, date, method } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO collections (stallion_id, mare_id, cycle_id, date, method) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [stallionId, mareId, cycleId, date, method]
    );
    const c = result.rows[0];
    res.json({ id: c.id, stallionId: c.stallion_id, mareId: c.mare_id, cycleId: c.cycle_id, date: c.date, method: c.method });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stallions/:id/report', authMiddleware, async (req, res) => {
  const stallionId = req.params.id;
  try {
    const result = await pool.query('SELECT * FROM collections WHERE stallion_id = $1', [stallionId]);
    res.json({ stallionId, collections: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Seed route ----------
app.get('/api/seed', async (req, res) => {
  try {
    const existing = await pool.query('SELECT id FROM users LIMIT 1');
    if (existing.rows.length > 0) {
      return res.json({ message: 'User already exists' });
    }
    const hashed = bcrypt.hashSync('horse2026', 10);
    await pool.query('INSERT INTO users (name, email, password) VALUES ($1, $2, $3)', ['Admin', 'admin@horse.com', hashed]);
    res.json({ message: 'Default user created', email: 'admin@horse.com', password: 'horse2026' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Health & Static ----------
const path = require('path');
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