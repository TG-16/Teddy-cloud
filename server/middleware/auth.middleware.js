const authMiddleware = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).send("Unauthorized");

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;

        // --- IN-MEMORY CACHE CHECK ---
        if (!userCache.has(decoded.id)) {
            // Lazy load user info from DB if not in memory
            const userData = await pool.query(`
                SELECT u.status, p.allocated_storage_gb, s.used_bytes 
                FROM users u
                JOIN user_plan_details p ON u.id = p.user_id
                JOIN storage_usage s ON u.id = s.user_id
                WHERE u.id = $1`, [decoded.id]);
            
            userCache.set(decoded.id, userData.rows[0]);
        }
        
        next();
    } catch (err) {
        res.status(401).send("Invalid Token");
    }
};