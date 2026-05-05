/** @module tokenUtils — Secure JWT access + refresh token generation and validation */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Generates an access token + refresh token pair for a user.
 * @param {{ email: string, name: string, id: number }} user
 * @returns {{ accessToken: string, refreshToken: string, refreshTokenHash: string, refreshExpiresAt: number }}
 */
function generateTokenPair(user) {
    const accessToken = jwt.sign(
        { email: user.email, name: user.name },
        process.env.JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const refreshExpiresAt = Date.now() + REFRESH_TOKEN_EXPIRY_MS;

    return { accessToken, refreshToken, refreshTokenHash, refreshExpiresAt };
}

/**
 * Verifies an access token. Returns decoded payload or null.
 * @param {string} token
 * @returns {object|null}
 */
function verifyAccessToken(token) {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return null;
    }
}

/**
 * Checks if an access token is within N minutes of expiry.
 * @param {string} token
 * @param {number} minutesBeforeExpiry
 * @returns {boolean}
 */
function isTokenNearExpiry(token, minutesBeforeExpiry = 2) {
    try {
        const decoded = jwt.decode(token);
        if (!decoded || !decoded.exp) return false;
        const expiresAt = decoded.exp * 1000; // Convert to ms
        const threshold = minutesBeforeExpiry * 60 * 1000;
        return (expiresAt - Date.now()) < threshold;
    } catch {
        return false;
    }
}

/**
 * SHA-256 hash a refresh token for secure DB storage.
 * @param {string} token
 * @returns {string}
 */
function hashRefreshToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Stores a refresh token hash in the database.
 * @param {object} db - better-sqlite3 instance
 * @param {number} userId
 * @param {string} tokenHash
 * @param {number} expiresAt - timestamp ms
 */
function storeRefreshToken(db, userId, tokenHash, expiresAt) {
    db.prepare(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
    ).run(userId, tokenHash, expiresAt);
}

/**
 * Validates a refresh token against the database.
 * @param {object} db
 * @param {string} rawToken
 * @returns {{ valid: boolean, userId?: number, tokenHash?: string }}
 */
function validateRefreshToken(db, rawToken) {
    const tokenHash = hashRefreshToken(rawToken);
    const row = db.prepare(
        'SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked = 0 AND expires_at > ?'
    ).get(tokenHash, Date.now());

    if (!row) return { valid: false };
    return { valid: true, userId: row.user_id, tokenHash };
}

/**
 * Revokes a specific refresh token.
 * @param {object} db
 * @param {string} tokenHash
 */
function revokeRefreshToken(db, tokenHash) {
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?').run(tokenHash);
}

/**
 * Revokes ALL refresh tokens for a user (e.g., on password change).
 * @param {object} db
 * @param {number} userId
 */
function revokeAllUserTokens(db, userId) {
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?').run(userId);
}

/**
 * Cleans up expired/revoked tokens older than 30 days.
 * @param {object} db
 */
function cleanupExpiredTokens(db) {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    db.prepare('DELETE FROM refresh_tokens WHERE (revoked = 1 OR expires_at < ?) AND expires_at < ?')
        .run(Date.now(), thirtyDaysAgo);
}

module.exports = {
    generateTokenPair,
    verifyAccessToken,
    isTokenNearExpiry,
    hashRefreshToken,
    storeRefreshToken,
    validateRefreshToken,
    revokeRefreshToken,
    revokeAllUserTokens,
    cleanupExpiredTokens,
    ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_EXPIRY_MS
};
