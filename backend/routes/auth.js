import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import passport from "passport";
import { body, validationResult } from "express-validator";

import User from "../models/User.js";
import { sendVerificationEmail } from "../utils/mailer.js";
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

export default router;