import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;
import crypto from 'crypto';
import serverless from 'serverless-http';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // large payloads

// --- DATABASE CONNECTION ---
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("FATAL: DATABASE_URL environment variable is not set.");
  app.use((req, res, next) => {
    res.status(500).json({ message: "Server not configured. Database connection string missing." });
  });
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

// --- HELPER FUNCTION ---
const generateRandomPassword = (length = 10) =>
  crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);

// --- ROUTER ---
const router = express.Router();

// Health check
router.get('/', (req, res) => {
  res.json({ message: 'Scraping Data Speaker API is online and running.' });
});

// User login
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email=$1 AND password=$2',
      [email, password]
    );
    if (result.rows.length) {
      const { password: _, ...user } = result.rows[0];
      res.json(user);
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT email, "isAdmin" FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add a new user
router.post('/users', async (req, res) => {
  let { email, password, isAdmin } = req.body;
  if (!password) password = generateRandomPassword();
  try {
    const result = await pool.query(
      'INSERT INTO users (email, password, "isAdmin") VALUES ($1, $2, $3) RETURNING *',
      [email, password, isAdmin]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'User exists.' });
    res.status(500).json({ message: err.message });
  }
});

// Update user
router.put('/users/:originalEmail', async (req, res) => {
  const { originalEmail } = req.params;
  const { email, password } = req.body;
  try {
    let result;
    if (password) {
      result = await pool.query(
        'UPDATE users SET email=$1, password=$2 WHERE email=$3 RETURNING email, "isAdmin"',
        [email, password, originalEmail]
      );
    } else {
      result = await pool.query(
        'UPDATE users SET email=$1 WHERE email=$2 RETURNING email, "isAdmin"',
        [email, originalEmail]
      );
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Email already in use.' });
    res.status(500).json({ message: err.message });
  }
});

// Change password
router.put('/users/change-password', async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;
  if (!email || !currentPassword || !newPassword)
    return res.status(400).json({ message: 'Missing fields.' });

  try {
    const verify = await pool.query(
      'SELECT id FROM users WHERE email=$1 AND password=$2',
      [email, currentPassword]
    );
    if (!verify.rows.length) return res.status(401).json({ message: 'Incorrect password.' });

    await pool.query('UPDATE users SET password=$1 WHERE email=$2', [newPassword, email]);
    res.json({ message: 'Password updated.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete user
router.delete('/users/:email', async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE email=$1', [req.params.email]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- Speaker routes (same as above, mount under router) ---
router.get('/speakers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM speakers');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Other /speakers routes...
// ... (copy all your speakers CRUD routes here, replacing app with router)

app.use('/api', router);

// --- EXPORT SERVERLESS FUNCTION ---
export default serverless(app);
