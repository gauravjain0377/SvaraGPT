import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import passport from "passport";
import { body, validationResult } from "express-validator";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import crypto from "crypto";
import { UAParser } from "ua-parser-js";
import geoip from "geoip-lite";
import { getGeolocation, getCountryFlag } from "../utils/geolocation.js";

import User from "../models/User.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../utils/mailer.js";
import { sendContactEmail } from "../utils/mailer.js";
import { generateVerificationCode } from "../utils/verification.js";
import { generateAccessToken, generateRefreshToken, verifyToken } from "../utils/tokens.js";
import { authGuard } from "../middleware/authGuard.js";

const router = express.Router();

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: true, // Always use secure for cross-domain
    sameSite: "none", // Required for cross-site cookies between Vercel and Render
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: "/", // Ensure cookies are available across all paths
};

function setAuthCookies(res, { accessToken, refreshToken }) {
    const accessMaxAge = parseInt(process.env.JWT_ACCESS_MAXAGE || "900", 10) * 1000;
    const refreshMaxAge = parseInt(process.env.JWT_REFRESH_MAXAGE || "604800", 10) * 1000;

    res.cookie("svara_access", accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: accessMaxAge,
    });

    res.cookie("svara_refresh", refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: refreshMaxAge,
    });
}

function clearAuthCookies(res) {
    res.clearCookie("svara_access", COOKIE_OPTIONS);
    res.clearCookie("svara_refresh", COOKIE_OPTIONS);
}

router.post(
    "/register",
    [
        body("email").isEmail().withMessage("Valid email is required"),
        body("password")
            .isLength({ min: 8 })
            .withMessage("Password must be at least 8 characters"),
        body("name").trim().notEmpty().withMessage("Name is required"),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password, name } = req.body;

        try {
            const existing = await User.findOne({ email: email.toLowerCase() });
            
            if (existing) {
                if (!existing.isVerified) {
                    const { code, expiresAt } = generateVerificationCode();
                    existing.verificationCode = code;
                    existing.verificationExpires = expiresAt;
                    await existing.save();
                    await sendVerificationEmail(existing.email, existing.name, code);
                    return res.status(200).json({ message: "Verification code resent." });
                }
                return res.status(409).json({ error: "Email already registered." });
            }

            const passwordHash = await bcrypt.hash(password, 12);
            const { code, expiresAt } = generateVerificationCode();

            const user = await User.create({
                email: email.toLowerCase(),
                name,
                passwordHash,
                isVerified: false,
                verificationCode: code,
                verificationExpires: expiresAt,
            });

            await sendVerificationEmail(user.email, user.name, code);
            
            res.status(201).json({ message: "Verification email sent." });
        } catch (error) {
            console.error("❌ [REGISTER] Error:", error);
            res.status(500).json({ error: "Failed to register user.", details: error.message });
        }
    }
);

router.post(
    "/verify",
    [
        body("email").isEmail().withMessage("Valid email is required"),
        body("code").isLength({ min: 6, max: 6 }).withMessage("6-digit code required"),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, code } = req.body;

        try {
            const user = await User.findOne({ email: email.toLowerCase() });
            if (!user) {
                return res.status(404).json({ error: "User not found." });
            }

            if (user.isVerified) {
                const tokens = await issueTokens(user, req);
                setAuthCookies(res, tokens);
                return res.status(200).json({ message: "Already verified.", user: user.profile() });
            }
            
            if (
                !user.verificationCode ||
                user.verificationCode !== code ||
                !user.verificationExpires ||
                user.verificationExpires.getTime() < Date.now()
            ) {
                return res.status(400).json({ error: "Invalid or expired code." });
            }

            user.isVerified = true;
            user.verificationCode = null;
            user.verificationExpires = null;
            await user.save();

            const tokens = await issueTokens(user, req);
            setAuthCookies(res, tokens);

            res.status(200).json({ message: "Email verified.", user: user.profile() });
        } catch (error) {
            console.error("❌ [VERIFY] Error:", error);
            res.status(500).json({ error: "Failed to verify email.", details: error.message });
        }
    }
);

router.post(
    "/login",
    [
        body("email").isEmail().withMessage("Valid email is required"),
        body("password").notEmpty().withMessage("Password is required"),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        try {
            const user = await User.findOne({ email: email.toLowerCase() });
            if (!user) {
                return res.status(401).json({ error: "Invalid credentials." });
            }

            if (!user.isVerified) {
                return res.status(403).json({ error: "Email not verified." });
            }

            const match = await bcrypt.compare(password, user.passwordHash || "");
            if (!match) {
                return res.status(401).json({ error: "Invalid credentials." });
            }

            // Check if 2FA is enabled
            if (user.twoFactorEnabled) {
                // If token is provided, verify it
                if (req.body.token) {
                    const verified = speakeasy.totp.verify({
                        secret: user.twoFactorSecret,
                        encoding: 'base32',
                        token: req.body.token,
                        window: 1
                    });
                    
                    // Also check backup codes (case-insensitive)
                    const isBackupCode = user.twoFactorBackupCodes && 
                                        user.twoFactorBackupCodes.some(code => 
                                            code.toUpperCase() === req.body.token.toUpperCase()
                                        );
                    
                    if (!verified && !isBackupCode) {
                        return res.status(401).json({ error: "Invalid 2FA code." });
                    }
                    
                    // If backup code was used, remove it
                    if (isBackupCode) {
                        user.twoFactorBackupCodes = user.twoFactorBackupCodes.filter(
                            code => code.toUpperCase() !== req.body.token.toUpperCase()
                        );
                        await user.save();
                    }
                } else {
                    // No token provided, return 2FA required status
                    // Create a temporary token for 2FA verification
                    const tempToken = jwt.sign(
                        { userId: user._id, require2FA: true },
                        process.env.JWT_SECRET,
                        { expiresIn: '5m' }
                    );
                    
                    return res.status(200).json({ 
                        requiresTwoFactor: true,
                        tempToken,
                        message: "2FA verification required."
                    });
                }
            }

            const tokens = await issueTokens(user, req);
            setAuthCookies(res, tokens);
            res.status(200).json({ message: "Login successful.", user: user.profile() });
        } catch (error) {
            console.error("❌ [LOGIN] Error:", error);
            res.status(500).json({ error: "Failed to login.", details: error.message });
        }
    }
);

router.post("/refresh", async (req, res) => {
    try {
        const refreshCookie = req.cookies?.svara_refresh;
        if (!refreshCookie) {
            return res.status(401).json({ error: "Missing refresh token." });
        }

        const payload = verifyToken(refreshCookie);
        if (!payload || !payload.sub) {
            clearAuthCookies(res);
            return res.status(401).json({ error: "Invalid refresh token." });
        }

        const user = await User.findById(payload.sub);
        if (!user) {
            clearAuthCookies(res);
            return res.status(401).json({ error: "Invalid refresh token." });
        }

        // Check if refresh token exists in user's tokens
        const tokenExists = user.refreshTokens.some((item) => item.token === refreshCookie);
        if (!tokenExists) {
            clearAuthCookies(res);
            return res.status(401).json({ error: "Refresh token not found." });
        }

        // Remove old refresh token
        user.refreshTokens = user.refreshTokens.filter((item) => item.token !== refreshCookie);

        const tokens = await issueTokens(user, req);
        setAuthCookies(res, tokens);
        res.status(200).json({ message: "Tokens refreshed.", user: user.profile() });
    } catch (error) {
        console.error("❌ [REFRESH] Error:", error);
        clearAuthCookies(res);
        res.status(401).json({ error: "Failed to refresh tokens." });
    }
});

router.post("/logout", async (req, res) => {
    try {
        const refreshCookie = req.cookies?.svara_refresh;
        if (refreshCookie) {
            const payload = jwt.decode(refreshCookie);
            if (payload?.sub) {
                await User.findByIdAndUpdate(payload.sub, {
                    $pull: { refreshTokens: { token: refreshCookie } },
                });
            }
        }

        clearAuthCookies(res);
        res.status(200).json({ message: "Logged out." });
    } catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({ error: "Failed to logout." });
    }
});

router.get("/me", authGuard, (req, res, next) => {
    console.log("🔍 /auth/me request received");
    console.log("🍪 Cookies:", req.cookies);
    console.log("👤 User in session:", req.user);
    
    if (!req.user) {
        console.log("❌ No authenticated user found");
        return res.status(401).json({ error: "Authentication required" });
    }
    
    console.log("✅ User authenticated:", req.user.email);
    res.json({ user: req.user.profile ? req.user.profile() : req.user });
});

// 2FA Setup Endpoint - Generates a secret and QR code
router.post("/2fa/setup", authGuard, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        // Generate a new secret
        const secret = speakeasy.generateSecret({
            name: `SvaraGPT:${user.email}`,
            length: 20
        });
        
        // Store the secret temporarily (not enabled yet until verification)
        user.twoFactorSecret = secret.base32;
        await user.save();
        
        // Generate QR code
        const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);
        
        res.json({
            success: true,
            secret: secret.base32,
            qrCode: qrCodeUrl,
            message: "2FA setup initiated. Scan the QR code with your authenticator app and verify with the code."
        });
    } catch (error) {
        console.error("2FA Setup Error:", error);
        res.status(500).json({ success: false, message: "Failed to setup 2FA" });
    }
});

// 2FA Verification Endpoint - Verifies token and enables 2FA
router.post("/2fa/verify", authGuard, async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ success: false, message: "Verification code is required" });
        }
        
        const user = await User.findById(req.user.id);
        
        if (!user.twoFactorSecret) {
            return res.status(400).json({ success: false, message: "2FA setup not initiated" });
        }
        
        // Verify the token
        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: token,
            window: 1 // Allow 1 period before and after for clock drift
        });
        
        if (!verified) {
            return res.status(400).json({ success: false, message: "Invalid verification code" });
        }
        
        // Generate backup codes (10 random codes)
        const backupCodes = [];
        for (let i = 0; i < 10; i++) {
            const code = crypto.randomBytes(4).toString('hex').toUpperCase();
            backupCodes.push(code);
        }
        
        // Enable 2FA
        user.twoFactorEnabled = true;
        user.twoFactorBackupCodes = backupCodes;
        await user.save();
        
        res.json({
            success: true,
            message: "Two-factor authentication enabled successfully",
            backupCodes: backupCodes
        });
    } catch (error) {
        console.error("2FA Verification Error:", error);
        res.status(500).json({ success: false, message: "Failed to verify 2FA" });
    }
});

// 2FA Status Endpoint - Returns the current 2FA status
router.get("/2fa/status", authGuard, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.json({
            success: true,
            enabled: user.twoFactorEnabled || false
        });
    } catch (error) {
        console.error("2FA Status Error:", error);
        res.status(500).json({ success: false, message: "Failed to get 2FA status" });
    }
});

// 2FA Disable Endpoint - Disables 2FA for the user
router.post("/2fa/disable", authGuard, async (req, res) => {
    try {
        const { token, password } = req.body;
        const user = await User.findById(req.user.id);
        
        if (!user.twoFactorEnabled) {
            return res.status(400).json({ success: false, message: "2FA is not enabled" });
        }
        
        // Verify password for additional security
        if (password) {
            const passwordMatch = await bcrypt.compare(password, user.passwordHash || "");
            if (!passwordMatch) {
                return res.status(401).json({ success: false, message: "Invalid password" });
            }
        }
        
        // If token is provided, verify it
        if (token) {
            const verified = speakeasy.totp.verify({
                secret: user.twoFactorSecret,
                encoding: 'base32',
                token: token,
                window: 1
            });
            
            // Also check backup codes
            const isBackupCode = user.twoFactorBackupCodes && 
                                user.twoFactorBackupCodes.includes(token);
            
            if (!verified && !isBackupCode) {
                return res.status(401).json({ success: false, message: "Invalid verification code" });
            }
        }
        
        // Disable 2FA
        user.twoFactorEnabled = false;
        user.twoFactorSecret = undefined;
        user.twoFactorBackupCodes = [];
        await user.save();
        
        res.json({
            success: true,
            message: "Two-factor authentication disabled successfully"
        });
    } catch (error) {
        console.error("2FA Disable Error:", error);
        res.status(500).json({ success: false, message: "Failed to disable 2FA" });
    }
});

// 2FA status endpoint
router.get("/2fa/status", authGuard, (req, res) => {
    console.log("🔍 /auth/2fa/status request received");
    
    // Return actual 2FA status from user model
    res.json({ 
        enabled: req.user.twoFactorEnabled || false,
        setup_required: false,
        message: req.user.twoFactorEnabled 
            ? "Two-factor authentication is enabled for this account" 
            : "Two-factor authentication is not enabled for this account"
    });
});

// 2FA setup endpoint - generates secret and QR code
router.post("/2fa/setup", authGuard, async (req, res) => {
    try {
        // Generate new secret
        const secret = speakeasy.generateSecret({
            name: `SvaraGPT:${req.user.email}`
        });
        
        // Generate QR code
        const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);
        
        // Save secret to user (not enabled yet until verified)
        req.user.twoFactorSecret = secret.base32;
        await req.user.save();
        
        res.json({
            secret: secret.base32,
            qrCode: qrCodeUrl,
            message: "Two-factor authentication setup initiated. Verify with code to enable."
        });
    } catch (error) {
        console.error("2FA setup error:", error);
        res.status(500).json({ error: "Failed to setup two-factor authentication" });
    }
});

// 2FA verification endpoint - verifies token and enables 2FA
router.post("/2fa/verify", authGuard, async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ error: "Verification code is required" });
        }
        
        if (!req.user.twoFactorSecret) {
            return res.status(400).json({ error: "Two-factor authentication not set up" });
        }
        
        // Verify the token
        const verified = speakeasy.totp.verify({
            secret: req.user.twoFactorSecret,
            encoding: 'base32',
            token: token
        });
        
        if (!verified) {
            return res.status(400).json({ error: "Invalid verification code" });
        }
        
        // Enable 2FA
        req.user.twoFactorEnabled = true;
        
        // Generate backup codes (10 hexadecimal codes)
        const backupCodes = [];
        for (let i = 0; i < 10; i++) {
            const code = crypto.randomBytes(4).toString('hex').toUpperCase();
            backupCodes.push(code);
        }
        req.user.twoFactorBackupCodes = backupCodes;
        
        await req.user.save();
        
        res.json({
            success: true,
            backupCodes,
            message: "Two-factor authentication enabled successfully"
        });
    } catch (error) {
        console.error("2FA verification error:", error);
        res.status(500).json({ error: "Failed to verify two-factor authentication" });
    }
});

// 2FA disable endpoint
router.post("/2fa/disable", authGuard, async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!req.user.twoFactorEnabled) {
            return res.status(400).json({ success: false, error: "Two-factor authentication is not enabled" });
        }
        
        // If token is provided, verify it
        if (token) {
            const verified = speakeasy.totp.verify({
                secret: req.user.twoFactorSecret,
                encoding: 'base32',
                token: token,
                window: 1
            });
            
            // Also check backup codes
            const isBackupCode = req.user.twoFactorBackupCodes && 
                                req.user.twoFactorBackupCodes.includes(token.toUpperCase());
            
            if (!verified && !isBackupCode) {
                return res.status(400).json({ success: false, error: "Invalid verification code" });
            }
        }
        
        // Disable 2FA
        req.user.twoFactorEnabled = false;
        req.user.twoFactorSecret = undefined;
        req.user.twoFactorBackupCodes = [];
        
        await req.user.save();
        
        res.json({
            success: true,
            message: "Two-factor authentication disabled successfully"
        });
    } catch (error) {
        console.error("2FA disable error:", error);
        res.status(500).json({ success: false, error: "Failed to disable two-factor authentication" });
    }
});

// 2FA regenerate backup codes endpoint
router.post("/2fa/regenerate-backup-codes", authGuard, async (req, res) => {
    try {
        if (!req.user.twoFactorEnabled) {
            return res.status(400).json({ success: false, error: "Two-factor authentication is not enabled" });
        }
        
        // Generate new backup codes (10 random codes)
        const backupCodes = [];
        for (let i = 0; i < 10; i++) {
            const code = crypto.randomBytes(4).toString('hex').toUpperCase();
            backupCodes.push(code);
        }
        
        // Update user's backup codes
        req.user.twoFactorBackupCodes = backupCodes;
        await req.user.save();
        
        res.json({
            success: true,
            backupCodes: backupCodes,
            message: "Backup codes regenerated successfully"
        });
    } catch (error) {
        console.error("Regenerate backup codes error:", error);
        res.status(500).json({ success: false, error: "Failed to regenerate backup codes" });
    }
});

// 2FA get backup codes endpoint - Returns existing backup codes
router.get("/2fa/backup-codes", authGuard, async (req, res) => {
    try {
        if (!req.user.twoFactorEnabled) {
            return res.status(400).json({ success: false, error: "Two-factor authentication is not enabled" });
        }
        
        // Return existing backup codes
        const backupCodes = req.user.twoFactorBackupCodes || [];
        const remainingCodes = backupCodes.length;
        
        res.json({
            success: true,
            backupCodes: backupCodes,
            remainingCodes: remainingCodes,
            message: `You have ${remainingCodes} backup code(s) remaining`
        });
    } catch (error) {
        console.error("Get backup codes error:", error);
        res.status(500).json({ success: false, error: "Failed to retrieve backup codes" });
    }
});

// 2FA login verification endpoint
router.post("/login/verify", async (req, res) => {
    try {
        const { token, tempToken } = req.body;
        
        if (!token || !tempToken) {
            return res.status(400).json({ 
                success: false, 
                message: "Verification code and temporary token are required" 
            });
        }
        
        // Verify the temporary token
        let decoded;
        try {
            decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
        } catch (error) {
            return res.status(401).json({ 
                success: false, 
                message: "Invalid or expired session. Please login again." 
            });
        }
        
        // Check if token requires 2FA
        if (!decoded.require2FA) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid authentication flow" 
            });
        }
        
        // Get user
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found" 
            });
        }
        
        // Verify the 2FA token
        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: token,
            window: 1 // Allow 30 seconds before/after
        });
        
        // Check backup codes (case-insensitive)
        const isBackupCode = user.twoFactorBackupCodes && 
                            user.twoFactorBackupCodes.some(code => code.toUpperCase() === token.toUpperCase());
        
        if (!verified && !isBackupCode) {
            return res.status(401).json({ 
                success: false, 
                message: "Invalid verification code" 
            });
        }
        
        // If using backup code, remove it
        if (isBackupCode) {
            user.twoFactorBackupCodes = user.twoFactorBackupCodes.filter(
                code => code.toUpperCase() !== token.toUpperCase()
            );
            await user.save();
        }
        
        // Generate tokens
        const tokens = await issueTokens(user, req);
        setAuthCookies(res, tokens);
        
        res.json({ 
            success: true,
            message: "Login successful",
            user: user.profile()
        });
    } catch (error) {
        console.error("❌ [2FA LOGIN] Error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Verification failed", 
            details: error.message 
        });
    }
});

router.post(
    "/resend-code",
    [body("email").isEmail().withMessage("Valid email is required")],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email } = req.body;

        try {
            const user = await User.findOne({ email: email.toLowerCase() });
            if (!user) {
                return res.status(404).json({ error: "User not found." });
            }

            if (user.isVerified) {
                return res.status(400).json({ error: "User already verified." });
            }

            const now = Date.now();
            if (user.verificationExpires && user.verificationExpires.getTime() > now && user.verificationCode) {
                return res.status(429).json({ error: "Wait before requesting another code." });
            }

            const { code, expiresAt } = generateVerificationCode();
            user.verificationCode = code;
            user.verificationExpires = expiresAt;
            await user.save();

            await sendVerificationEmail(user.email, user.name, code);
            res.status(200).json({ message: "Verification code resent." });
        } catch (error) {
            console.error("Resend code error:", error);
            res.status(500).json({ error: "Failed to resend code." });
        }
    }
);

router.get("/google", passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
}));

router.get(
    "/google/callback",
    passport.authenticate("google", { failureRedirect: `${process.env.FRONTEND_URL}/login?error=google` }),
    async (req, res) => {
        try {
            const user = req.user;
            if (!user) {
                return res.redirect(`${process.env.FRONTEND_URL}/login?error=google`);
            }
            
            const tokens = await issueTokens(user, req);
            setAuthCookies(res, tokens);
            res.redirect(`${process.env.FRONTEND_URL}/home`);
        } catch (error) {
            console.error("❌ [GOOGLE CALLBACK] Error:", error);
            res.redirect(`${process.env.FRONTEND_URL}/login?error=google`);
        }
    }
);

router.get("/google/success", (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
    }

    res.json({ user: req.user.profile() });
});

async function issueTokens(user, req) {
    const accessToken = generateAccessToken(user._id.toString());
    const refreshToken = generateRefreshToken(user._id.toString());

    // Get IP address - try multiple sources
    let ip = "unknown";
    
    // Check x-forwarded-for header (common in proxies/load balancers)
    if (req.headers['x-forwarded-for']) {
        const forwardedIps = req.headers['x-forwarded-for'].split(',');
        ip = forwardedIps[0].trim();
    } 
    // Check x-real-ip header
    else if (req.headers['x-real-ip']) {
        ip = req.headers['x-real-ip'];
    }
    // Fallback to connection/socket remote address
    else if (req.connection?.remoteAddress) {
        ip = req.connection.remoteAddress;
    }
    else if (req.socket?.remoteAddress) {
        ip = req.socket.remoteAddress;
    }
    
    // Clean up IPv6 localhost to IPv4
    if (ip === '::1') {
        ip = '127.0.0.1';
    }
    // Remove IPv6 prefix if present
    if (ip && ip.includes('::ffff:')) {
        ip = ip.replace('::ffff:', '');
    }
    
    console.log('🌐 [issueTokens] Extracted IP:', ip);
    
    // Parse User-Agent using ua-parser-js
    const userAgent = req.headers["user-agent"] || "unknown";
    const parser = new UAParser(userAgent);
    const uaResult = parser.getResult();
    
    console.log('🔍 [issueTokens] UA Parser Result:', {
        device: uaResult.device,
        browser: uaResult.browser,
        os: uaResult.os
    });
    
    // Extract device information
    const deviceType = uaResult.device.type || "desktop"; // mobile, tablet, desktop
    const browser = uaResult.browser.name || "Unknown Browser";
    const browserVersion = uaResult.browser.version || "";
    const os = uaResult.os.name || "Unknown OS";
    const osVersion = uaResult.os.version || "";
    
    // Get location from IP using geolocation API
    let location = "Unknown";
    let country = "Unknown";
    let countryCode = "XX";
    let city = "Unknown";
    
    if (ip && ip !== "unknown" && !ip.includes('127.0.0.1') && !ip.startsWith('192.168.') && !ip.startsWith('10.')) {
        console.log('🌍 [issueTokens] Looking up geolocation for IP:', ip);
        try {
            const geoData = await getGeolocation(ip);
            country = geoData.country;
            countryCode = geoData.countryCode;
            city = geoData.city;
            location = city !== "Unknown" ? `${city}, ${country}` : country;
            console.log('✅ [issueTokens] Geolocation result:', { country, countryCode, city });
        } catch (error) {
            console.error('❌ [issueTokens] Geolocation lookup failed:', error);
        }
    } else {
        console.log('⚠️ [issueTokens] Skipping geolocation for local IP:', ip);
        // For localhost during development, show test location data
        if (process.env.NODE_ENV !== 'production') {
            country = "Local Development";
            countryCode = "IN";
            city = "Localhost";
            location = "Localhost (Dev Mode)";
            console.log('🔧 [issueTokens] Using development mock location');
        }
    }

    user.refreshTokens.push({
        token: refreshToken,
        userAgent,
        ip,
        device: deviceType,
        browser: browserVersion ? `${browser} ${browserVersion}` : browser,
        os: osVersion ? `${os} ${osVersion}` : os,
        location,
        country,
        countryCode,
        city,
        createdAt: new Date(),
        lastActive: new Date(),
    });

    await user.save();

    return { accessToken, refreshToken };
}

// Change Password Endpoint - For authenticated users
router.post("/change-password", 
    authGuard,
    [
        body("currentPassword").notEmpty().withMessage("Current password is required"),
        body("newPassword")
            .isLength({ min: 8 })
            .withMessage("New password must be at least 8 characters"),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { currentPassword, newPassword } = req.body;

        try {
            const user = await User.findById(req.user.id);
            
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            // Check if user is using local authentication (not Google OAuth)
            if (!user.passwordHash) {
                return res.status(400).json({ 
                    error: "Cannot change password for OAuth users" 
                });
            }

            // Verify current password
            const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
            if (!isMatch) {
                return res.status(401).json({ error: "Current password is incorrect" });
            }

            // Check if new password is same as current
            const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
            if (isSamePassword) {
                return res.status(400).json({ 
                    error: "New password must be different from current password" 
                });
            }

            // Hash and update new password
            const newPasswordHash = await bcrypt.hash(newPassword, 12);
            user.passwordHash = newPasswordHash;
            await user.save();

            res.status(200).json({ 
                success: true,
                message: "Password changed successfully" 
            });
        } catch (error) {
            console.error("❌ [CHANGE PASSWORD] Error:", error);
            res.status(500).json({ 
                error: "Failed to change password",
                details: error.message 
            });
        }
    }
);

// Forgot Password Endpoint - Sends reset code via email
router.post("/forgot-password",
    [
        body("email").isEmail().withMessage("Valid email is required"),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email } = req.body;

        try {
            const user = await User.findOne({ email: email.toLowerCase() });
            
            // Don't reveal if email exists for security
            if (!user) {
                return res.status(200).json({ 
                    message: "If an account exists, a password reset code has been sent" 
                });
            }

            // Check if user is using local authentication
            if (!user.passwordHash) {
                return res.status(400).json({ 
                    error: "This account uses Google sign-in. Please login with Google." 
                });
            }

            // Generate reset code
            const { code, expiresAt } = generateVerificationCode();
            user.passwordResetCode = code;
            user.passwordResetExpires = expiresAt;
            await user.save();

            // Send email
            await sendPasswordResetEmail(user.email, user.name, code);

            res.status(200).json({ 
                success: true,
                message: "If an account exists, a password reset code has been sent" 
            });
        } catch (error) {
            console.error("❌ [FORGOT PASSWORD] Error:", error);
            res.status(500).json({ 
                error: "Failed to process password reset request",
                details: error.message 
            });
        }
    }
);

// Reset Password Endpoint - Verifies code and updates password
router.post("/reset-password",
    [
        body("email").isEmail().withMessage("Valid email is required"),
        body("code").isLength({ min: 6, max: 6 }).withMessage("6-digit code required"),
        body("newPassword")
            .isLength({ min: 8 })
            .withMessage("Password must be at least 8 characters"),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, code, newPassword } = req.body;

        try {
            const user = await User.findOne({ email: email.toLowerCase() });
            
            if (!user) {
                return res.status(404).json({ error: "Invalid or expired reset code" });
            }

            // Verify reset code
            if (
                !user.passwordResetCode ||
                user.passwordResetCode !== code ||
                !user.passwordResetExpires ||
                user.passwordResetExpires.getTime() < Date.now()
            ) {
                return res.status(400).json({ error: "Invalid or expired reset code" });
            }

            // Hash new password
            const newPasswordHash = await bcrypt.hash(newPassword, 12);
            user.passwordHash = newPasswordHash;
            user.passwordResetCode = null;
            user.passwordResetExpires = null;
            await user.save();

            res.status(200).json({ 
                success: true,
                message: "Password reset successfully. You can now login with your new password." 
            });
        } catch (error) {
            console.error("❌ [RESET PASSWORD] Error:", error);
            res.status(500).json({ 
                error: "Failed to reset password",
                details: error.message 
            });
        }
    }
);

// Sessions management (for Active Sessions UI)
router.get("/sessions", authGuard, async (req, res) => {
    try {
        const currentRefreshToken = req.cookies?.svara_refresh;
        const user = await User.findById(req.user.id).lean();
        
        const sessions = (user?.refreshTokens || []).map((t) => {
            const sessionId = crypto.createHash('sha256').update(t.token).digest('hex').slice(0, 24);
            const isCurrent = currentRefreshToken === t.token;
            
            // Get device type from user agent or stored device field
            let deviceType = t.device || 'desktop';
            if (deviceType === 'mobile') deviceType = 'mobile';
            else if (deviceType === 'tablet') deviceType = 'tablet';
            else deviceType = 'desktop';
            
            // Get country flag
            const countryCode = t.countryCode || 'XX';
            const flag = getCountryFlag(countryCode);
            
            // Better device name formatting
            const deviceName = t.os || 'Unknown Device';
            const browserName = t.browser || 'Unknown Browser';
            
            // Clean up IP address display
            let displayIp = t.ip || 'Unknown IP';
            if (displayIp.includes('::ffff:')) {
                displayIp = displayIp.replace('::ffff:', '');
            }
            if (displayIp === '::1') displayIp = '127.0.0.1 (localhost)';
            
            return {
                id: sessionId,
                device: deviceName,
                browser: browserName,
                ip: displayIp,
                country: t.country || 'Unknown',
                countryCode: countryCode,
                city: t.city || 'Unknown',
                location: t.location || 'Unknown',
                flag: flag,
                loginTime: t.createdAt,
                lastActive: t.lastActive || t.createdAt,
                deviceType: deviceType,
                current: isCurrent
            };
        });
        
        // Sort by current first, then by last active
        sessions.sort((a, b) => {
            if (a.current && !b.current) return -1;
            if (!a.current && b.current) return 1;
            return new Date(b.lastActive) - new Date(a.lastActive);
        });
        
        res.json({ sessions });
    } catch (e) {
        console.error('Error listing sessions', e);
        res.status(500).json({ error: 'Failed to load sessions' });
    }
});

router.delete("/sessions/:id", authGuard, async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const before = user.refreshTokens.length;
        user.refreshTokens = user.refreshTokens.filter((rt) => {
            const sessionId = crypto.createHash('sha256').update(rt.token).digest('hex').slice(0, 24);
            return sessionId !== id;
        });
        
        await user.save();
        
        const deleted = before !== user.refreshTokens.length;
        return res.json({ 
            success: deleted,
            message: deleted ? 'Session logged out successfully' : 'Session not found'
        });
    } catch (e) {
        console.error('Error deleting session', e);
        res.status(500).json({ error: 'Failed to delete session' });
    }
});

router.delete("/sessions/all", authGuard, async (req, res) => {
    try {
        const currentRefreshToken = req.cookies?.svara_refresh;
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Keep only the current session
        if (currentRefreshToken) {
            user.refreshTokens = user.refreshTokens.filter(
                (rt) => rt.token === currentRefreshToken
            );
        } else {
            // If no current token, remove all
            user.refreshTokens = [];
        }
        
        await user.save();
        
        res.json({ 
            success: true,
            message: 'All other sessions logged out successfully'
        });
    } catch (e) {
        console.error('Error deleting all sessions', e);
        res.status(500).json({ error: 'Failed to delete all sessions' });
    }
});

export default router;