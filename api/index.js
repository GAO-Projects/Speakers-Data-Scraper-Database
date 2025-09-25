import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;
import crypto from 'crypto';
import Cursor from 'pg-cursor';
import Papa from 'papaparse';

const app = express();
const apiRouter = express.Router(); // Create a new router

app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json({ limit: '10mb' })); // Enable parsing of JSON bodies, increase limit for large CSVs

// --- DATABASE CONNECTION ---
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
}

// --- DATABASE AVAILABILITY MIDDLEWARE ---
apiRouter.use((req, res, next) => {
    if (!pool) {
        return res.status(503).json({ 
            message: "Database connection is not available. Please check server configuration." 
        });
    }
    next();
});


// --- HELPER FUNCTIONS ---
const generateRandomPassword = (length = 10) => {
    return crypto.randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);
};

const escapeCsvValue = (value) => {
    if (value == null) return '';
    const strValue = String(value);
    if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
        return `"${strValue.replace(/"/g, '""')}"`;
    }
    return strValue;
};

// A simple, predictable normalizer: lowercase and remove all whitespace.
const normalizeKey = (key) => {
    if (!key) return '';
    return key.toLowerCase().replace(/\s+/g, '');
};

// Creates an exhaustive mapping from various normalized header names to the correct SpeakerData keys.
const getFieldMap = () => {
    const map = {};

    const aliases = {
        // Main Aliases
        'firstname': 'firstName', 'lastname': 'lastName', 'title': 'title', 'company': 'company',
        'businessemail': 'businessEmail', 'email': 'businessEmail', 'emailaddress': 'businessEmail',
        'workemail': 'businessEmail', 'country': 'country', 'website': 'website', 'fullname': 'fullName',
        'emailvalid': 'isEmailValid', 'isemailvalid': 'isEmailValid', 'linkedvalid': 'isLinkedInValid',
        'islinkedinvalid': 'isLinkedInValid', 'websitevalid': 'isWebsiteValid', 'iswebsitevalid': 'isWebsiteValid',
        'extractedrole': 'extractedRole', 'isceo': 'isCeo', 'isspeaker': 'isSpeaker', 'isauthor': 'isAuthor',
        'industry': 'industry', 'personlinkedinurl': 'personLinkedinUrl', 'linkedin': 'personLinkedinUrl',
        'linkedinurl': 'personLinkedinUrl', 'stage': 'stage', 'phonenumber': 'phoneNumber', 'phone': 'phoneNumber',
        'employees': 'employees', 'location': 'location', 'city': 'city', 'state': 'state',
        'companyaddress': 'companyAddress', 'companycity': 'companyCity', 'companystate': 'companyState',
        'companycountry': 'companyCountry', 'companyphone': 'companyPhone', 'secondaryemail': 'secondaryEmail',
        'speakingtopic': 'speakingTopic', 'speakinginfotopic': 'speakingTopic', 'speakinglink': 'speakingLink',
        'speakinginfolink': 'speakingLink', 'createdby': 'createdBy', 'id': 'id'
    };
    
    for (const alias in aliases) {
        map[normalizeKey(alias)] = aliases[alias];
    }
    
    return map;
};

// Generate the map once for efficiency
const fieldMap = getFieldMap();


// --- HEALTH CHECK / ROOT ENDPOINT ---
apiRouter.get('/', (req, res) => {
    res.status(200).json({ message: 'Scraping Data Speaker API is online and running.' });
});


// --- API ENDPOINTS ---

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

// Add a new user
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

// Change own password
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

// Update a user
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


// Delete a user and their speaker data
apiRouter.delete('/users/:email', async (req, res) => {
    const { email } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM speakers WHERE "createdBy" = $1', [email]);
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

// Export interns data
apiRouter.get('/users/export/interns', async (req, res) => {
    const client = await pool.connect();
    try {
        const query = 'SELECT email, "isAdmin" FROM users WHERE "isAdmin" = false';
        const cursor = client.query(new Cursor(query));
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="interns_export.csv"');
        
        const headers = ['email', 'role'];
        res.write(headers.join(',') + '\n');

        const readNextBatch = () => {
            cursor.read(100, (err, rows) => {
                if (err) {
                    console.error('Error reading from cursor:', err);
                    if (!res.headersSent) res.status(500).send('Error exporting data');
                    client.release();
                    return;
                }

                if (rows.length === 0) {
                    res.end();
                    client.release();
                    return;
                }

                const csvRows = rows.map(row => {
                    return [escapeCsvValue(row.email), 'Intern'].join(',');
                }).join('\n');
                
                res.write(csvRows + '\n', 'utf-8', readNextBatch);
            });
        };
        
        readNextBatch();

    } catch (err) {
        console.error('Export interns error:', err);
        if (!res.headersSent) res.status(500).send('Error starting export');
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

// Bulk add speakers from JSON body
apiRouter.post('/speakers/bulk', async (req, res) => {
    const speakers = req.body;
    if (!speakers || !Array.isArray(speakers) || speakers.length === 0) {
        return res.status(400).json({ message: 'No speaker data provided.' });
    }

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
        await client.query('BEGIN');

        let totalImportedCount = 0;
        const batchSize = 200;

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
        
        await client.query('COMMIT');
        
        const skippedCount = speakers.length - totalImportedCount;

        res.json({ importedCount: totalImportedCount, skippedCount });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Bulk import transaction failed:', err);
        res.status(500).json({ message: 'An error occurred during the import. The operation was rolled back.' });
    } finally {
        client.release();
    }
});

// Bulk add speakers from CSV upload
apiRouter.post('/speakers/upload-csv', async (req, res) => {
    const { csvContent, createdBy } = req.body;
    if (!csvContent || !createdBy) {
        return res.status(400).json({ message: 'CSV content and creator email are required.' });
    }

    try {
        const parseResult = Papa.parse(csvContent, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => {
                const cleanedHeader = header.charCodeAt(0) === 0xFEFF ? header.slice(1) : header;
                return cleanedHeader.trim();
            },
        });

        if (parseResult.errors.length > 0) {
            console.warn('CSV parsing encountered non-fatal errors:', parseResult.errors);
        }

        const parsedRows = parseResult.data;

        const remappedData = parsedRows.map(originalRow => {
            const newRow = {};
            for (const originalHeader in originalRow) {
                const normalizedHeader = normalizeKey(originalHeader);
                const finalKey = fieldMap[normalizedHeader];
                if (finalKey) {
                    newRow[finalKey] = originalRow[originalHeader];
                }
            }
            return newRow;
        });

        const dataToImport = [];
        for (const row of remappedData) {
            if (row.businessEmail && String(row.businessEmail).trim()) {
                const getBool = (key) => ['true', '1', 'yes'].includes(String(row[key] ?? '').toLowerCase());
                dataToImport.push({
                    createdBy: createdBy,
                    firstName: row.firstName || '', lastName: row.lastName || '', title: row.title || '', company: row.company || '',
                    businessEmail: row.businessEmail, country: row.country || '', website: row.website || '',
                    fullName: row.fullName || `${row.firstName || ''} ${row.lastName || ''}`.trim(), extractedRole: row.extractedRole || '',
                    industry: row.industry || '', personLinkedinUrl: row.personLinkedinUrl || '', stage: row.stage || '', phoneNumber: row.phoneNumber || '',
                    employees: row.employees || '', location: row.location || '', city: row.city || '', state: row.state || '',
                    companyAddress: row.companyAddress || '', companyCity: row.companyCity || '', companyState: row.companyState || '',
                    companyCountry: row.companyCountry || '', companyPhone: row.companyPhone || '', secondaryEmail: row.secondaryEmail || '',
                    speakingTopic: row.speakingTopic || '', speakingLink: row.speakingLink || '', isEmailValid: getBool('isEmailValid'),
                    isLinkedInValid: getBool('isLinkedInValid'), isWebsiteValid: getBool('isWebsiteValid'), isCeo: getBool('isCeo'),
                    isSpeaker: getBool('isSpeaker'), isAuthor: getBool('isAuthor'),
                });
            }
        }

        if (dataToImport.length === 0) {
            return res.status(400).json({ message: 'No valid speaker data with business emails found in the CSV.' });
        }
        
        // This logic is duplicated from /speakers/bulk. Could be refactored in a real-world scenario.
        const seenEmails = new Set();
        const uniqueSpeakers = dataToImport.filter(s => {
            const lowerCaseEmail = s.businessEmail.toLowerCase();
            const duplicate = seenEmails.has(lowerCaseEmail);
            seenEmails.add(lowerCaseEmail);
            return !duplicate;
        });

        if (uniqueSpeakers.length === 0) {
             return res.json({ importedCount: 0, skippedCount: dataToImport.length });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            let totalImportedCount = 0;
            const batchSize = 200;

            for (let i = 0; i < uniqueSpeakers.length; i += batchSize) {
                const batch = uniqueSpeakers.slice(i, i + batchSize);
                const valuesClause = [];
                const queryParams = [];
                let paramIndex = 1;
                batch.forEach(s => {
                    const newId = `speaker-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
                    const rowParams = [newId, s.createdBy, s.firstName, s.lastName, s.title, s.company, s.businessEmail, s.country, s.website, s.fullName, s.isEmailValid, s.isLinkedInValid, s.isWebsiteValid, s.extractedRole, s.isCeo, s.isSpeaker, s.isAuthor, s.industry, s.personLinkedinUrl, s.stage, s.phoneNumber, s.employees, s.location, s.city, s.state, s.companyAddress, s.companyCity, s.companyState, s.companyCountry, s.companyPhone, s.secondaryEmail, s.speakingTopic, s.speakingLink];
                    const paramPlaceholders = rowParams.map(() => `$${paramIndex++}`);
                    valuesClause.push(`(${paramPlaceholders.join(', ')})`);
                    queryParams.push(...rowParams);
                });
                const query = `INSERT INTO speakers (id, "createdBy", "firstName", "lastName", title, company, "businessEmail", country, website, "fullName", "isEmailValid", "isLinkedInValid", "isWebsiteValid", "extractedRole", "isCeo", "isSpeaker", "isAuthor", industry, "personLinkedinUrl", stage, "phoneNumber", employees, location, city, state, "companyAddress", "companyCity", "companyState", "companyCountry", "companyPhone", "secondaryEmail", "speakingTopic", "speakingLink") VALUES ${valuesClause.join(', ')} ON CONFLICT ("businessEmail") DO NOTHING RETURNING id;`;
                const result = await client.query(query, queryParams);
                totalImportedCount += result.rowCount;
            }
            await client.query('COMMIT');
            const skippedCount = dataToImport.length - totalImportedCount;
            res.json({ importedCount: totalImportedCount, skippedCount });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('CSV import transaction failed:', err);
            res.status(500).json({ message: 'An error occurred during the CSV import. The operation was rolled back.' });
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Error processing CSV upload:', err);
        res.status(500).json({ message: 'An internal server error occurred while processing the CSV file.' });
    }
});


// Export all speaker data
apiRouter.get('/speakers/export', async (req, res) => {
    const client = await pool.connect();
    try {
        const query = 'SELECT * FROM speakers';
        const cursor = client.query(new Cursor(query));

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="speaker_data_export.csv"');
        
        let isFirstBatch = true;

        const readNextBatch = () => {
            cursor.read(100, (err, rows) => {
                if (err) {
                    console.error('Error reading from cursor:', err);
                    if (!res.headersSent) res.status(500).send('Error exporting data');
                    client.release();
                    return;
                }

                if (rows.length === 0) {
                    res.end();
                    client.release();
                    return;
                }

                if (isFirstBatch) {
                    const headers = Object.keys(rows[0]);
                    res.write(headers.join(',') + '\n');
                    isFirstBatch = false;
                }

                const csvRows = rows.map(row => 
                    Object.values(row).map(escapeCsvValue).join(',')
                ).join('\n');
                
                res.write(csvRows + '\n', 'utf-8', readNextBatch);
            });
        };
        
        readNextBatch();

    } catch (err) {
        console.error('Export speakers error:', err);
        if (!res.headersSent) res.status(500).send('Error starting export');
        client.release();
    }
});

// Export speaker data for a specific user
apiRouter.get('/speakers/export/user/:email', async (req, res) => {
    const { email } = req.params;
    const client = await pool.connect();
    try {
        const query = 'SELECT * FROM speakers WHERE "createdBy" = $1';
        const cursor = client.query(new Cursor(query, [email]));

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="speaker_data_${email}.csv"`);
        
        let isFirstBatch = true;

        const readNextBatch = () => {
            cursor.read(100, (err, rows) => {
                if (err) {
                    console.error('Error reading from cursor:', err);
                    if (!res.headersSent) res.status(500).send('Error exporting data');
                    client.release();
                    return;
                }

                if (rows.length === 0) {
                    res.end();
                    client.release();
                    return;
                }

                if (isFirstBatch && rows.length > 0) {
                    const headers = Object.keys(rows[0]);
                    res.write(headers.join(',') + '\n');
                    isFirstBatch = false;
                }

                const csvRows = rows.map(row => 
                    Object.values(row).map(escapeCsvValue).join(',')
                ).join('\n');
                
                res.write(csvRows + '\n', 'utf-8', readNextBatch);
            });
        };
        
        readNextBatch();

    } catch (err) {
        console.error('Export user speakers error:', err);
        if (!res.headersSent) res.status(500).send('Error starting export');
        client.release();
    }
});

// Mount the router on the /api path
app.use('/api', apiRouter);

// --- EXPORT APP FOR VERCEL ---
export default app;
