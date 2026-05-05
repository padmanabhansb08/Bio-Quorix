/** @module tokenUtils.test — Tests for JWT access/refresh token utilities */
const { describe, it, expect, beforeAll } = require('vitest');

// Set env vars before importing the module
beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
});

const { generateTokenPair, verifyAccessToken, isTokenNearExpiry, hashRefreshToken } = require('../../utils/tokenUtils');

describe('Token Utilities', () => {
    const mockUser = { email: 'test@quorix.ai', name: 'Test User', id: 1 };

    it('should generate a valid token pair', () => {
        const pair = generateTokenPair(mockUser);
        expect(pair.accessToken).toBeTruthy();
        expect(pair.refreshToken).toBeTruthy();
        expect(pair.refreshTokenHash).toBeTruthy();
        expect(pair.refreshExpiresAt).toBeGreaterThan(Date.now());
    });

    it('should verify a valid access token', () => {
        const pair = generateTokenPair(mockUser);
        const decoded = verifyAccessToken(pair.accessToken);
        expect(decoded).not.toBeNull();
        expect(decoded.email).toBe('test@quorix.ai');
    });

    it('should return null for an invalid access token', () => {
        const result = verifyAccessToken('invalid.token.here');
        expect(result).toBeNull();
    });

    it('should hash refresh tokens consistently', () => {
        const token = 'my-refresh-token';
        const hash1 = hashRefreshToken(token);
        const hash2 = hashRefreshToken(token);
        expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different tokens', () => {
        const hash1 = hashRefreshToken('token-1');
        const hash2 = hashRefreshToken('token-2');
        expect(hash1).not.toBe(hash2);
    });

    it('should detect token NOT near expiry for a fresh token', () => {
        const pair = generateTokenPair(mockUser);
        expect(isTokenNearExpiry(pair.accessToken, 2)).toBe(false);
    });

    it('should generate unique refresh tokens each call', () => {
        const pair1 = generateTokenPair(mockUser);
        const pair2 = generateTokenPair(mockUser);
        expect(pair1.refreshToken).not.toBe(pair2.refreshToken);
    });
});
