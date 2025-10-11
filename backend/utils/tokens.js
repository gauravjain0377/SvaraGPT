import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_MAXAGE || "15m";
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_MAXAGE || "7d";

export function generateAccessToken(userId) {
    return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function generateRefreshToken(userId) {
    return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

export function getAccessTokenMaxAge() {
    const value = process.env.JWT_ACCESS_MAXAGE || "15m";
    return parseTimeToMs(value);
}

export function getRefreshTokenMaxAge() {
    const value = process.env.JWT_REFRESH_MAXAGE || "7d";
    return parseTimeToMs(value);
}

function parseTimeToMs(timeStr) {
    const units = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
    };
    
    const match = timeStr.match(/^(\d+)([smhd])$/);
    if (!match) return 15 * 60 * 1000; // default 15 minutes
    
    const [, value, unit] = match;
    return parseInt(value) * units[unit];
}