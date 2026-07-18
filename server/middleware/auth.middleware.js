const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// In-memory cache store
const userCache = new Map();

const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Access token missing" });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Contains { id, isAdmin }

        // 1. Check if user is in memory
        if (!userCache.has(decoded.id)) {
            // 2. Lazy load from DB if missing
            const result = await pool.query(`
                SELECT u.status, p.allocated_storage_gb, s.used_bytes 
                FROM users u
                JOIN user_plan_details p ON u.id = p.user_id
                JOIN storage_usage s ON u.id = s.user_id
                WHERE u.id = $1`, [decoded.id]);

            if (result.rowCount === 0) {
                return res.status(404).json({ error: "User data not found" });
            }

            userCache.set(decoded.id, result.rows[0]);
        }

        // 3. Fast access check
        const userData = userCache.get(decoded.id);
        
        if (userData.status === 'DEACTIVATED') {
            return res.status(403).json({ error: "Account deactivated" });
        }

        // Attach to req for easy use in controllers
        req.userMetadata = userData;
        
        next();
    } catch (err) {
        return res.status(403).json({ error: "Invalid token" });
    }
};

// Helper to update cache when usage changes (e.g., after upload/delete)
const updateCacheUsage = (userId, newUsedBytes) => {
    if (userCache.has(userId)) {
        const userData = userCache.get(userId);
        userData.used_bytes = newUsedBytes;
        userCache.set(userId, userData);
    }
};

module.exports = { authMiddleware, updateCacheUsage };