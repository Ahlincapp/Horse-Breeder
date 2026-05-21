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
let db = { users: [], mares: [], cycles: [], stallions: [], collections: [], vet_appointments: [] };
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
        CREATE TABLE IF NOT EXISTS mare_breeding (
          id SERIAL PRIMARY KEY,
          mare_id INTEGER UNIQUE REFERENCES mares(id),
          breed_dates DATE[],
          confirmed_in_foal DATE,
          gestation_date DATE,
          created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS stallion_schedule (
          id SERIAL PRIMARY KEY,
          stallion_id INTEGER UNIQUE REFERENCES stallions(id),
          collection_days INTEGER[],
          created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS vet_appointments (
          id SERIAL PRIMARY KEY,
          mare_id INTEGER REFERENCES mares(id),
          stallion_id INTEGER REFERENCES stallions(id),
          date DATE NOT NULL,
          time TIME,
          vet_name VARCHAR(255),
          reason VARCHAR(255),
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
      console.log('✅ PostgreSQL database initialized');
    } finally {
      client.release();
    }
  } else {
    loadJsonDb();
    // Ensure new collections exist in JSON file
    if (!db.mare_breeding) db.mare_breeding = [];
    if (!db.stallion_schedule) db.stallion_schedule = [];
    if (!db.vet_appointments) db.vet_appointments = [];
    console.log('✅ JSON file database initialized');
  }
}

initDb();

// Helper: generate JWT
function generateToken(user) {
  const payload = { id: user.id, name: user.name, email: user.email };
  return jwt.sign(payload, process.env.JWT_SECRET || 'defaultsecret', { expiresIn: '7d' });
}

// Middleware: protect routes - bypass auth for now (temp fix)
function authMiddleware(req, res, next) {
  // TEMP: Skip auth and use default user
  // TODO: Fix auth properly
  req.user = { id: 1778864389096, name: 'Admin', email: 'admin@horse.com' };
  return next();
  
  /* Original auth code:
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
  */
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
      res.json(result.rows.map(m => ({ id: m.id, userId: m.user_id, registeredName: m.registered_name, barnName: m.barn_name, dob: m.dob, registry: m.registry })));
    } else {
      const mares = db.mares.filter(m => m.userId === req.user.id);
      res.json(mares);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/mares', authMiddleware, async (req, res) => {
  const { registeredName, barnName, dob, registry } = req.body;
  try {
    if (usePostgres) {
      const result = await pool.query(
        'INSERT INTO mares (user_id, registered_name, barn_name, dob, registry) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [req.user.id, registeredName, barnName || null, dob, registry || null]
      );
      const mare = result.rows[0];
      res.json({ id: mare.id, userId: mare.user_id, registeredName: mare.registered_name, barnName: mare.barn_name, dob: mare.dob, registry: mare.registry });
    } else {
      const mare = { id: Date.now(), userId: req.user.id, registeredName, barnName: barnName || null, dob, registry: registry || null, created_at: new Date().toISOString() };
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
  const { registeredName, barnName, dob, registry } = req.body;
  try {
    if (usePostgres) {
      const result = await pool.query(
        'UPDATE mares SET registered_name = $1, barn_name = $2, dob = $3, registry = $4 WHERE id = $5 RETURNING *',
        [registeredName, barnName || null, dob, registry || null, mareId]
      );
      const mare = result.rows[0];
      res.json({ id: mare.id, userId: mare.user_id, registeredName: mare.registered_name, barnName: mare.barn_name, dob: mare.dob, registry: mare.registry });
    } else {
      const idx = db.mares.findIndex(m => m.id === parseInt(mareId));
      if (idx === -1) return res.status(404).json({ error: 'Mare not found' });
      db.mares[idx] = { ...db.mares[idx], registeredName, barnName: barnName || null, dob, registry: registry || null };
      saveJsonDb();
      res.json(db.mares[idx]);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mare breeding info endpoints
app.get('/api/mares/:mareId/breeding', authMiddleware, async (req, res) => {
  const { mareId } = req.params;
  try {
    if (usePostgres) {
      const result = await pool.query('SELECT * FROM mare_breeding WHERE mare_id = $1', [mareId]);
      if (result.rows.length === 0) {
        res.json({ mareId: parseInt(mareId), breedDates: [], confirmedInFoal: null, gestationDate: null });
      } else {
        const b = result.rows[0];
        res.json({ mareId: b.mare_id, breedDates: b.breed_dates || [], confirmedInFoal: b.confirmed_in_foal, gestationDate: b.gestation_date });
      }
    } else {
      const breeding = db.mare_breeding.find(b => b.mareId === parseInt(mareId));
      res.json(breeding || { mareId: parseInt(mareId), breedDates: [], confirmedInFoal: null, gestationDate: null });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/mares/:mareId/breeding', authMiddleware, async (req, res) => {
  const { mareId } = req.params;
  const { breedDate, breedDates, confirmedInFoal, gestationDate } = req.body;
  try {
    // Get mare's registry to calculate gestation period
    let mare;
    if (usePostgres) {
      const mResult = await pool.query('SELECT registry FROM mares WHERE id = $1', [mareId]);
      mare = mResult.rows[0];
    } else {
      mare = db.mares.find(m => m.id === parseInt(mareId));
    }
    
    const gestationPeriod = BREED_GESTATION_PERIODS[mare?.registry] || BREED_GESTATION_PERIODS['default'];
    
    // Get existing breeding info
    let existingBreedDates = [];
    if (usePostgres) {
      const existing = await pool.query('SELECT breed_dates FROM mare_breeding WHERE mare_id = $1', [mareId]);
      if (existing.rows.length > 0) {
        existingBreedDates = existing.rows[0].breed_dates || [];
      }
    } else {
      const existing = db.mare_breeding.find(b => b.mareId === parseInt(mareId));
      if (existing) {
        existingBreedDates = existing.breedDates || [];
      }
    }
    
    // Handle new breed date - append to array
    let newBreedDates = [...existingBreedDates];
    if (breedDate && !newBreedDates.includes(breedDate)) {
      newBreedDates.push(breedDate);
      newBreedDates.sort(); // Keep sorted
    }
    
    // Auto-calculate gestation date if confirmedInFoal is set but gestationDate is not
    let autoGestationDate = gestationDate;
    const latestBreedDate = newBreedDates.length > 0 ? newBreedDates[newBreedDates.length - 1] : null;
    if (confirmedInFoal && !gestationDate && latestBreedDate) {
      const bd = new Date(latestBreedDate);
      bd.setDate(bd.getDate() + gestationPeriod);
      autoGestationDate = bd.toISOString().split('T')[0];
    } else if (confirmedInFoal && !gestationDate && !latestBreedDate) {
      // Use confirmedInFoal date as the breeding reference point
      const cf = new Date(confirmedInFoal);
      cf.setDate(cf.getDate() + gestationPeriod);
      autoGestationDate = cf.toISOString().split('T')[0];
    }
    
    if (usePostgres) {
      await pool.query(
        `INSERT INTO mare_breeding (mare_id, breed_dates, confirmed_in_foal, gestation_date)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (mare_id) DO UPDATE SET
         breed_dates = $2, confirmed_in_foal = $3, gestation_date = $4`,
        [mareId, newBreedDates, confirmedInFoal || null, autoGestationDate || null]
      );
      res.json({ mareId: parseInt(mareId), breedDates: newBreedDates, confirmedInFoal, gestationDate: autoGestationDate });
    } else {
      const idx = db.mare_breeding.findIndex(b => b.mareId === parseInt(mareId));
      const breeding = { mareId: parseInt(mareId), breedDates: newBreedDates, confirmedInFoal, gestationDate: autoGestationDate };
      if (idx >= 0) {
        db.mare_breeding[idx] = breeding;
      } else {
        db.mare_breeding.push(breeding);
      }
      saveJsonDb();
      res.json(breeding);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Estimated cycles and gestation based on breed averages
const BREED_CYCLE_LENGTHS = {
  'American Quarter Horse Association': 21,
  'American Paint Horse Association': 21,
  'Thoroughbred': 21,
  'Arabian Horse Association': 22,
  'American Morgan Horse Association': 21,
  'American Mustang': 22,
  'Other': 21,
  'default': 21
};

const BREED_GESTATION_PERIODS = {
  'American Quarter Horse Association': 340,
  'American Paint Horse Association': 340,
  'Thoroughbred': 340,
  'Arabian Horse Association': 335,
  'American Morgan Horse Association': 340,
  'American Mustang': 335,
  'Other': 340,
  'default': 340
};

app.get('/api/mares/:mareId/estimated-cycles', authMiddleware, async (req, res) => {
  const { mareId } = req.params;
  const { count = 26 } = req.query; // Default to ~6 months worth (26 cycles of ~21 days)
  try {
    let mare, cycles;
    if (usePostgres) {
      const mareResult = await pool.query('SELECT * FROM mares WHERE id = $1', [mareId]);
      const cycleResult = await pool.query('SELECT * FROM cycles WHERE mare_id = $1 ORDER BY start_date DESC', [mareId]);
      mare = mareResult.rows[0];
      cycles = cycleResult.rows;
    } else {
      mare = db.mares.find(m => m.id === parseInt(mareId));
      cycles = db.cycles.filter(c => c.mareId === parseInt(mareId)).sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    }
    
    if (!mare) return res.status(404).json({ error: 'Mare not found' });
    
    const cycleLength = BREED_CYCLE_LENGTHS[mare.registry] || BREED_CYCLE_LENGTHS['default'];
    const estimatedCycles = [];
    
    // Start from the last actual cycle, or use last breed date, or default to today
    let lastDate;
    if (cycles.length > 0) {
      // Use the most recent actual cycle as base
      lastDate = new Date(cycles[0].start_date);
    } else {
      // Check breeding info for most recent breed date from breedDates array
      let breeding;
      if (usePostgres) {
        const bResult = await pool.query('SELECT breed_dates FROM mare_breeding WHERE mare_id = $1', [mareId]);
        breeding = bResult.rows[0];
      } else {
        breeding = db.mare_breeding.find(b => b.mareId === parseInt(mareId));
      }
      const breedDates = breeding?.breedDates || [];
      if (breedDates.length > 0) {
        lastDate = new Date(breedDates[breedDates.length - 1]); // Use most recent
      } else {
        lastDate = new Date();
      }
    }
    
    // Generate future cycles (starting from next cycle after the last one)
    const numCycles = Math.min(parseInt(count), 30); // Cap at 30 to avoid too many
    for (let i = 1; i <= numCycles; i++) {
      const cycleDate = new Date(lastDate);
      cycleDate.setDate(cycleDate.getDate() + (i * cycleLength));
      // Only include future dates
      if (cycleDate > new Date()) {
        estimatedCycles.push(cycleDate.toISOString().split('T')[0]);
      }
    }
    
    res.json({ estimatedCycles, cycleLength });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-generate cycles from estimated
app.post('/api/mares/:mareId/auto-cycles', authMiddleware, async (req, res) => {
  const { mareId } = req.params;
  const { count = 6 } = req.body;
  try {
    let mare;
    if (usePostgres) {
      const result = await pool.query('SELECT * FROM mares WHERE id = $1', [mareId]);
      mare = result.rows[0];
    } else {
      mare = db.mares.find(m => m.id === parseInt(mareId));
    }
    
    if (!mare) return res.status(404).json({ error: 'Mare not found' });
    
    const cycleLength = BREED_CYCLE_LENGTHS[mare.registry] || BREED_CYCLE_LENGTHS['default'];
    const heatDuration = 7; // 7 days heat
    let lastDate = new Date();
    
    // Find last actual cycle to start from
    let cycles;
    if (usePostgres) {
      const cycleResult = await pool.query('SELECT start_date FROM cycles WHERE mare_id = $1 ORDER BY start_date DESC LIMIT 1', [mareId]);
      cycles = cycleResult.rows;
    } else {
      cycles = db.cycles.filter(c => c.mareId === parseInt(mareId)).sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    }
    
    if (cycles.length > 0) {
      lastDate = new Date(cycles[0].start_date);
    }
    
    const newCycles = [];
    for (let i = 0; i < count; i++) {
      const startDate = new Date(lastDate);
      startDate.setDate(startDate.getDate() + (i * cycleLength));
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + heatDuration);
      
      const cycle = {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      };
      
      if (usePostgres) {
        const result = await pool.query(
          'INSERT INTO cycles (mare_id, start_date, end_date) VALUES ($1, $2, $3) RETURNING *',
          [mareId, cycle.startDate, cycle.endDate]
        );
        newCycles.push(result.rows[0]);
      } else {
        const newCycle = { id: Date.now() + i, mareId: parseInt(mareId), startDate: cycle.startDate, endDate: cycle.endDate, created_at: new Date().toISOString() };
        db.cycles.push(newCycle);
        newCycles.push(newCycle);
      }
    }
    
    if (!usePostgres) saveJsonDb();
    res.json({ success: true, cycles: newCycles });
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
  const { registeredName, barnName, dob, registry } = req.body;
  try {
    if (usePostgres) {
      const result = await pool.query(
        'INSERT INTO stallions (registered_name, barn_name, dob, registry) VALUES ($1, $2, $3, $4) RETURNING *',
        [registeredName, barnName || null, dob, registry || null]
      );
      const s = result.rows[0];
      res.json({ id: s.id, registeredName: s.registered_name, barnName: s.barn_name, dob: s.dob, registry: s.registry });
    } else {
      const stallion = { id: Date.now(), registeredName, barnName: barnName || null, dob, registry: registry || null, created_at: new Date().toISOString() };
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
      res.json(result.rows.map(s => ({ id: s.id, registeredName: s.registered_name, barnName: s.barn_name, dob: s.dob, registry: s.registry })));
    } else {
      res.json(db.stallions);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/stallions/:stallionId', authMiddleware, async (req, res) => {
  const { stallionId } = req.params;
  const { registeredName, barnName, dob, registry } = req.body;
  try {
    if (usePostgres) {
      const result = await pool.query(
        'UPDATE stallions SET registered_name = $1, barn_name = $2, dob = $3, registry = $4 WHERE id = $5 RETURNING *',
        [registeredName, barnName || null, dob, registry || null, stallionId]
      );
      const s = result.rows[0];
      res.json({ id: s.id, registeredName: s.registered_name, barnName: s.barn_name, dob: s.dob, registry: s.registry });
    } else {
      const idx = db.stallions.findIndex(s => s.id === parseInt(stallionId));
      if (idx === -1) return res.status(404).json({ error: 'Stallion not found' });
      db.stallions[idx] = { ...db.stallions[idx], registeredName, barnName: barnName || null, dob, registry: registry || null };
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

// Stallion schedule (collection days)
app.get('/api/stallions/:stallionId/schedule', authMiddleware, async (req, res) => {
  const { stallionId } = req.params;
  try {
    if (usePostgres) {
      const result = await pool.query('SELECT * FROM stallion_schedule WHERE stallion_id = $1', [stallionId]);
      if (result.rows.length === 0) {
        res.json({ stallionId: parseInt(stallionId), days: [] });
      } else {
        res.json({ stallionId: result.rows[0].stallion_id, days: result.rows[0].collection_days || [] });
      }
    } else {
      const schedule = db.stallion_schedule.find(s => s.stallionId === parseInt(stallionId));
      res.json(schedule || { stallionId: parseInt(stallionId), days: [] });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/stallions/:stallionId/schedule', authMiddleware, async (req, res) => {
  const { stallionId } = req.params;
  const { days } = req.body; // Array of weekday numbers 0-6 (Sun-Sat)
  try {
    if (usePostgres) {
      await pool.query(
        `INSERT INTO stallion_schedule (stallion_id, collection_days)
         VALUES ($1, $2)
         ON CONFLICT (stallion_id) DO UPDATE SET collection_days = $2`,
        [stallionId, days || []]
      );
      res.json({ stallionId: parseInt(stallionId), days: days || [] });
    } else {
      const idx = db.stallion_schedule.findIndex(s => s.stallionId === parseInt(stallionId));
      const schedule = { stallionId: parseInt(stallionId), days: days || [] };
      if (idx >= 0) {
        db.stallion_schedule[idx] = schedule;
      } else {
        db.stallion_schedule.push(schedule);
      }
      saveJsonDb();
      res.json(schedule);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all collections for calendar
app.get('/api/collections', authMiddleware, async (req, res) => {
  try {
    if (usePostgres) {
      const result = await pool.query(`
        SELECT c.id, c.stallion_id, c.mare_id, c.date, c.method, c.cycle_id,
               s.registered_name as stallion_name, s.barn_name as stallion_barn,
               m.registered_name as mare_name, m.barn_name as mare_barn
        FROM collections c
        LEFT JOIN stallions s ON c.stallion_id = s.id
        LEFT JOIN mares m ON c.mare_id = m.id
        ORDER BY c.date DESC
      `);
      res.json(result.rows);
    } else {
      const collections = db.collections.map(c => {
        const stallion = db.stallions.find(s => s.id === c.stallionId);
        const mare = db.mares.find(m => m.id === c.mareId);
        return {
          ...c,
          stallion_name: stallion?.registeredName,
          stallion_barn: stallion?.barnName,
          mare_name: mare?.registeredName,
          mare_barn: mare?.barnName
        };
      });
      res.json(collections);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Vet Appointment routes (protected) ----------
app.get('/api/vet-appointments', authMiddleware, async (req, res) => {
  try {
    if (usePostgres) {
      const result = await pool.query(`
        SELECT v.id, v.mare_id, v.stallion_id, v.date, v.time, v.vet_name, v.reason, v.notes,
               m.registered_name as mare_name, m.barn_name as mare_barn,
               s.registered_name as stallion_name, s.barn_name as stallion_barn
        FROM vet_appointments v
        LEFT JOIN mares m ON v.mare_id = m.id
        LEFT JOIN stallions s ON v.stallion_id = s.id
        ORDER BY v.date ASC
      `);
      res.json(result.rows);
    } else {
      const appointments = db.vet_appointments.map(v => {
        const mare = db.mares.find(m => m.id === v.mareId);
        const stallion = db.stallions.find(s => s.id === v.stallionId);
        return {
          ...v,
          mare_name: mare?.registeredName,
          mare_barn: mare?.barnName,
          stallion_name: stallion?.registeredName,
          stallion_barn: stallion?.barnName
        };
      });
      res.json(appointments);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vet-appointments', authMiddleware, async (req, res) => {
  const { mareId, stallionId, date, time, vetName, reason, notes } = req.body;
  try {
    if (usePostgres) {
      const result = await pool.query(
        'INSERT INTO vet_appointments (mare_id, stallion_id, date, time, vet_name, reason, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [mareId || null, stallionId || null, date, time || null, vetName || null, reason || null, notes || null]
      );
      const v = result.rows[0];
      res.json({ id: v.id, mareId: v.mare_id, stallionId: v.stallion_id, date: v.date, time: v.time, vetName: v.vet_name, reason: v.reason, notes: v.notes });
    } else {
      const appt = { id: Date.now(), mareId: mareId || null, stallionId: stallionId || null, date, time: time || null, vetName: vetName || null, reason: reason || null, notes: notes || null, created_at: new Date().toISOString() };
      db.vet_appointments.push(appt);
      saveJsonDb();
      res.json(appt);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/vet-appointments/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    if (usePostgres) {
      await pool.query('DELETE FROM vet_appointments WHERE id = $1', [id]);
    } else {
      db.vet_appointments = db.vet_appointments.filter(v => v.id !== parseInt(id));
      saveJsonDb();
    }
    res.json({ success: true });
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