import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import passport from "passport";
import { body, validationResult } from "express-validator";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import crypto from "crypto";

import User from "../models/User.js";
import { sendVerificationEmail } from "../utils/mailer.js";
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
                    
                    // Also check backup codes
                    const isBackupCode = user.twoFactorBackupCodes && 
                                        user.twoFactorBackupCodes.includes(req.body.token);
                    
                    if (!verified && !isBackupCode) {
                        return res.status(401).json({ error: "Invalid 2FA code." });
                    }
                    
                    // If backup code was used, remove it
                    if (isBackupCode) {
                        user.twoFactorBackupCodes = user.twoFactorBackupCodes.filter(
                            code => code !== req.body.token
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
        
        // Generate backup codes (optional)
        const backupCodes = Array(5).fill().map(() => 
            Math.random().toString(36).substring(2, 8).toUpperCase()
        );
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
            return res.status(400).json({ error: "Two-factor authentication is not enabled" });
        }
        
        // Verify the token if provided
        if (token) {
            const verified = speakeasy.totp.verify({
                secret: req.user.twoFactorSecret,
                encoding: 'base32',
                token: token
            });
            
            if (!verified) {
                return res.status(400).json({ error: "Invalid verification code" });
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
        res.status(500).json({ error: "Failed to disable two-factor authentication" });
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
        
        // Check backup codes
        const isBackupCode = user.twoFactorBackupCodes && 
                            user.twoFactorBackupCodes.includes(token);
        
        if (!verified && !isBackupCode) {
            return res.status(401).json({ 
                success: false, 
                message: "Invalid verification code" 
            });
        }
        
        // If using backup code, remove it
        if (isBackupCode) {
            user.twoFactorBackupCodes = user.twoFactorBackupCodes.filter(code => code !== token);
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

    user.refreshTokens.push({
        token: refreshToken,
        userAgent: req.headers["user-agent"] || "unknown",
        createdAt: new Date(),
    });

    await user.save();

    return { accessToken, refreshToken };
}

// Sessions management (for Active Sessions UI)
router.get("/sessions", authGuard, async (req, res) => {
    try {
        // Each refresh token represents a session
        const user = await User.findById(req.user.id).lean();
        const sessions = (user?.refreshTokens || []).map((t) => ({
            id: crypto.createHash('sha256').update(t.token).digest('hex').slice(0, 24),
            browser: t.userAgent || 'Unknown',
            lastActive: t.createdAt || null,
            current: false
        }));
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
        if (!user) return res.status(404).json({ error: 'User not found' });
        const before = user.refreshTokens.length;
        user.refreshTokens = user.refreshTokens.filter((rt) => crypto.createHash('sha256').update(rt.token).digest('hex').slice(0, 24) !== id);
        await user.save();
        return res.json({ success: before !== user.refreshTokens.length });
    } catch (e) {
        console.error('Error deleting session', e);
        res.status(500).json({ error: 'Failed to delete session' });
    }
});

router.delete("/sessions/all", authGuard, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        user.refreshTokens = [];
        await user.save();
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting all sessions', e);
        res.status(500).json({ error: 'Failed to delete all sessions' });
    }
});

export default router;