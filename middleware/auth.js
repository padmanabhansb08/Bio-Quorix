const { verifyAccessToken, isTokenNearExpiry } = require('../utils/tokenUtils');
const db = require('../database');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const decoded = verifyAccessToken(token);
    if (!decoded) return res.status(403).json({ error: 'Forbidden' });

    req.user = decoded;
    req.db = db; // Inject db into request object for routers

    // JWT only stores email+name — look up the numeric id so routes can use req.user.id
    const userRow = db.prepare('SELECT id FROM users WHERE email = ?').get(decoded.email);
    if (userRow) req.user.id = userRow.id;

    // If token is near expiry, hint the client to refresh
    if (isTokenNearExpiry(token, 2)) {
        res.setHeader('X-Token-Expiring', 'true');
    }

    next();
};

module.exports = { authenticateToken };

