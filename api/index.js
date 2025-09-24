import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;
import crypto from 'crypto';

const app = express();
const apiRouter = express.Router(); // Create a new router

app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json({ limit: '10mb' })); // Enable parsing of JSON bodies, increase limit for large CSVs

// --- DATABASE CONNECTION ---
// Centralized pool creation. It's created once when the serverless function initializes.
let pool;
try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL environment variable is not set.");
    }
    pool = new Pool({
        connectionString,
        ssl: {
            rejectUnauthorized: false,
        },
    });
} catch (error) {
    console.error("Failed to initialize database pool:", error.message);
    // The pool remains undefined if initialization fails.
}

// --- DATABASE AVAILABILITY MIDDLEWARE ---
// This middleware runs for every request to the API router.
// It checks if the pool was successfully created.
apiRouter.use((req, res, next) => {
    if (!pool) {
        return res.status(503).json({ 
            message: "Database connection is not available. Please check server configuration." 
        });
    }
    next();
});


// --- HELPER FUNCTION ---
const generateRandomPassword = (length = 10) => {
    return crypto.randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);
};


// --- HEALTH CHECK / ROOT ENDPOINT ---
// This is now the root of the API router, accessible at /api/
apiRouter.get('/', (req, res) => {
    res.status(200).json({ message: 'Scraping Data Speaker API is online and running.' });
});


// --- API ENDPOINTS ---
// All routes are now attached to apiRouter and can safely assume `pool` is available

// User Login
apiRouter.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1 AND password = $2', [email, password]);
        if (result.rows.length > 0) {
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
apiRouter.get('/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT email, "isAdmin" FROM users');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Add a new user (with automatic password generation)
apiRouter.post('/users', async (req, res) => {
    let { email, password, isAdmin } = req.body;
    
    if (!password) {
        password = generateRandomPassword();
    }

    try {
        const result = await pool.query('INSERT INTO users (email, password, "isAdmin") VALUES ($1, $2, $3) RETURNING *', [email, password, isAdmin]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'A user with this email already exists.' });
        res.status(500).json({ message: err.message });
    }
});

// Change own password (by user) - MOVED UP
// This specific route must come BEFORE the parameterized route '/users/:originalEmail'
apiRouter.put('/users/change-password', async (req, res) => {
    const { email, currentPassword, newPassword } = req.body;

    if (!email || !currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Email, current password, and new password are required.' });
    }

    try {
        const verifyResult = await pool.query('SELECT id FROM users WHERE email = $1 AND password = $2', [email, currentPassword]);
        
        if (verifyResult.rows.length === 0) {
            return res.status(401).json({ message: 'Incorrect current password.' });
        }

        await pool.query('UPDATE users SET password = $1 WHERE email = $2', [newPassword, email]);
        
        res.status(200).json({ message: 'Password updated successfully.' });
    } catch (err) {
        console.error('Password change error:', err);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
});

// Update a user (by admin)
apiRouter.put('/users/:originalEmail', async (req, res) => {
    const { originalEmail } = req.params;
    const { email, password } = req.body;
    try {
        let result;
        if (password) {
            result = await pool.query('UPDATE users SET email = $1, password = $2 WHERE email = $3 RETURNING email, "isAdmin"', [email, password, originalEmail]);
        } else {
            result = await pool.query('UPDATE users SET email = $1 WHERE email = $2 RETURNING email, "isAdmin"', [email, originalEmail]);
        }
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'The new email address is already in use.' });
        res.status(500).json({ message: err.message });
    }
});


// Delete a user and all their associated speaker data in a transaction
apiRouter.delete('/users/:email', async (req, res) => {
    const { email } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Delete speaker data created by the user
        await client.query('DELETE FROM speakers WHERE "createdBy" = $1', [email]);
        // Delete the user
        await client.query('DELETE FROM users WHERE email = $1', [email]);
        await client.query('COMMIT');
        res.status(204).send();
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error in transaction for deleting user and data:', err);
        res.status(500).json({ message: 'Failed to delete user and associated data. Operation was rolled back.' });
    } finally {
        client.release();
    }
});

// Get all speaker data
apiRouter.get('/speakers', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM speakers');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get speaker data for a specific user
apiRouter.get('/speakers/user/:email', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM speakers WHERE "createdBy" = $1', [req.params.email]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Add new speaker data
apiRouter.post('/speakers', async (req, res) => {
    const s = req.body;
    const newId = `speaker-${Date.now()}-${Math.random()}`;
    const query = `
        INSERT INTO speakers (id, "createdBy", "firstName", "lastName", title, company, "businessEmail", country, website, "fullName", "isEmailValid", "isLinkedInValid", "isWebsiteValid", "extractedRole", "isCeo", "isSpeaker", "isAuthor", industry, "personLinkedinUrl", stage, "phoneNumber", employees, location, city, state, "companyAddress", "companyCity", "companyState", "companyCountry", "companyPhone", "secondaryEmail", "speakingTopic", "speakingLink")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)
        RETURNING *;
    `;
    const values = [newId, s.createdBy, s.firstName, s.lastName, s.title, s.company, s.businessEmail, s.country, s.website, s.fullName, s.isEmailValid, s.isLinkedInValid, s.isWebsiteValid, s.extractedRole, s.isCeo, s.isSpeaker, s.isAuthor, s.industry, s.personLinkedinUrl, s.stage, s.phoneNumber, s.employees, s.location, s.city, s.state, s.companyAddress, s.companyCity, s.companyState, s.companyCountry, s.companyPhone, s.secondaryEmail, s.speakingTopic, s.speakingLink];
    try {
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update speaker data
apiRouter.put('/speakers/:id', async (req, res) => {
    const { id } = req.params;
    const s = req.body;
    const query = 'UPDATE speakers SET "firstName"=$1, "lastName"=$2, title=$3, company=$4, "businessEmail"=$5, country=$6, website=$7, "fullName"=$8, "isEmailValid"=$9, "isLinkedInValid"=$10, "isWebsiteValid"=$11, "extractedRole"=$12, "isCeo"=$13, "isSpeaker"=$14, "isAuthor"=$15, industry=$16, "personLinkedinUrl"=$17, stage=$18, "phoneNumber"=$19, employees=$20, location=$21, city=$22, state=$23, "companyAddress"=$24, "companyCity"=$25, "companyState"=$26, "companyCountry"=$27, "companyPhone"=$28, "secondaryEmail"=$29, "speakingTopic"=$30, "speakingLink"=$31 WHERE id=$32 RETURNING *';
    const values = [s.firstName, s.lastName, s.title, s.company, s.businessEmail, s.country, s.website, s.fullName, s.isEmailValid, s.isLinkedInValid, s.isWebsiteValid, s.extractedRole, s.isCeo, s.isSpeaker, s.isAuthor, s.industry, s.personLinkedinUrl, s.stage, s.phoneNumber, s.employees, s.location, s.city, s.state, s.companyAddress, s.companyCity, s.companyState, s.companyCountry, s.companyPhone, s.secondaryEmail, s.speakingTopic, s.speakingLink, id];
    try {
        const result = await pool.query(query, values);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete speaker data
apiRouter.delete('/speakers/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM speakers WHERE id = $1', [req.params.id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Check if business email is in use
apiRouter.get('/speakers/email-check/:email', async (req, res) => {
    const { exclude } = req.query; // speakerIdToExclude
    try {
        let result;
        if (exclude) {
            result = await pool.query('SELECT 1 FROM speakers WHERE "businessEmail" = $1 AND id != $2', [req.params.email, exclude]);
        } else {
            result = await pool.query('SELECT 1 FROM speakers WHERE "businessEmail" = $1', [req.params.email]);
        }
        res.json({ inUse: result.rows.length > 0 });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Bulk add speakers - REFACTORED for performance and reliability
apiRouter.post('/speakers/bulk', async (req, res) => {
    const speakers = req.body;
    if (!speakers || !Array.isArray(speakers) || speakers.length === 0) {
        return res.status(400).json({ message: 'No speaker data provided.' });
    }

    // De-duplicate the incoming array based on businessEmail, keeping the first occurrence.
    const seenEmails = new Set();
    const uniqueSpeakers = speakers.filter(s => {
        if (!s.businessEmail) return false;
        const lowerCaseEmail = s.businessEmail.toLowerCase();
        const duplicate = seenEmails.has(lowerCaseEmail);
        seenEmails.add(lowerCaseEmail);
        return !duplicate;
    });

    if (uniqueSpeakers.length === 0) {
        return res.json({ importedCount: 0, skippedCount: speakers.length });
    }
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start transaction

        let totalImportedCount = 0;
        const batchSize = 200; // Process 200 records at a time to avoid parameter limit

        for (let i = 0; i < uniqueSpeakers.length; i += batchSize) {
            const batch = uniqueSpeakers.slice(i, i + batchSize);
            
            const valuesClause = [];
            const queryParams = [];
            let paramIndex = 1;

            batch.forEach(s => {
                const newId = `speaker-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
                const rowParams = [
                    newId, s.createdBy, s.firstName, s.lastName, s.title, s.company, s.businessEmail, s.country, s.website, s.fullName, s.isEmailValid, s.isLinkedInValid, s.isWebsiteValid, s.extractedRole, s.isCeo, s.isSpeaker, s.isAuthor, s.industry, s.personLinkedinUrl, s.stage, s.phoneNumber, s.employees, s.location, s.city, s.state, s.companyAddress, s.companyCity, s.companyState, s.companyCountry, s.companyPhone, s.secondaryEmail, s.speakingTopic, s.speakingLink
                ];
                
                const paramPlaceholders = rowParams.map(() => `$${paramIndex++}`);
                valuesClause.push(`(${paramPlaceholders.join(', ')})`);
                queryParams.push(...rowParams);
            });

            const query = `
                INSERT INTO speakers (id, "createdBy", "firstName", "lastName", title, company, "businessEmail", country, website, "fullName", "isEmailValid", "isLinkedInValid", "isWebsiteValid", "extractedRole", "isCeo", "isSpeaker", "isAuthor", industry, "personLinkedinUrl", stage, "phoneNumber", employees, location, city, state, "companyAddress", "companyCity", "companyState", "companyCountry", "companyPhone", "secondaryEmail", "speakingTopic", "speakingLink")
                VALUES ${valuesClause.join(', ')}
                ON CONFLICT ("businessEmail") DO NOTHING
                RETURNING id;
            `;
            
            const result = await client.query(query, queryParams);
            totalImportedCount += result.rowCount;
        }
        
        await client.query('COMMIT'); // Commit the transaction
        
        const skippedCount = speakers.length - totalImportedCount;

        res.json({ importedCount: totalImportedCount, skippedCount });

    } catch (err) {
        await client.query('ROLLBACK'); // Rollback on any error
        console.error('Bulk import transaction failed:', {
            message: err.message,
            code: err.code,
            detail: err.detail,
        });
        res.status(500).json({ message: 'An error occurred during the import. The operation was rolled back.' });
    } finally {
        client.release();
    }
});

// Mount the router on the /api path
app.use('/api', apiRouter);

// --- EXPORT APP FOR VERCEL ---
export default app;
