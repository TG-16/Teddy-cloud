const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db'); // Your PostgreSQL pool configuration

const JWT_SECRET = process.env.JWT_SECRET; // Move this to an environment variable!

// --- SIGN UP ---
exports.signup = async (req, res) => {
    const { email, password, invitation_code } = req.body;
    const client = await pool.connect(); // Get a dedicated client for transaction

    try {
        await client.query('BEGIN'); // Start Transaction

        let isAdmin = false;
        if (invitation_code) {
            const invite = await client.query(
                'SELECT * FROM invitation_codes WHERE code = $1 AND used_by IS NULL', 
                [invitation_code]
            );
            if (invite.rowCount === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: "Invalid or used invitation code" });
            }
            isAdmin = true;
        }

        const password_hash = await bcrypt.hash(password, 10);

        const newUser = await client.query(
            'INSERT INTO users (email, password_hash, is_admin) VALUES ($1, $2, $3) RETURNING id',
            [email, password_hash, isAdmin]
        );
        const userId = newUser.rows[0].id;

        if (invitation_code) {
            await client.query('UPDATE invitation_codes SET used_by = $1 WHERE code = $2', [userId, invitation_code]);
        }

        // Initialize Plan
        await client.query(
            'INSERT INTO user_plan_details (user_id, plan_id, allocated_storage_gb) VALUES ($1, $2, $3)',
            [userId, '3048e980-3ed7-401b-9b69-2a7fb46f05b3', 5]
        );

        // Initialize Usage
        await client.query(
            'INSERT INTO storage_usage (user_id, used_bytes) VALUES ($1, 0)',
            [userId]
        );

        await client.query('COMMIT'); // Commit all changes
        res.status(201).json({ message: "User registered successfully" });

    } catch (err) {
        await client.query('ROLLBACK'); // Undo everything if any error occurs
        res.status(500).json({ error: "Registration failed: " + err.message });
    } finally {
        client.release(); // Return client to pool
    }
};

// --- LOGIN ---
exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (user.rowCount === 0) return res.status(400).json({ error: "User not found" });

        const valid = await bcrypt.compare(password, user.rows[0].password_hash);
        if (!valid) return res.status(400).json({ error: "Invalid user or password" });

        if (user.rows[0].status === 'DEACTIVATED') return res.status(403).json({ error: "Account deactivated" });

        const token = jwt.sign({ id: user.rows[0].id, isAdmin: user.rows[0].is_admin }, JWT_SECRET);
        res.json({ token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};