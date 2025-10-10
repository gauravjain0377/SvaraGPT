import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { sendVerificationEmail } from "../utils/emailService.js";
import passport from "passport";

const router = express.Router();

// Register new user
router.post("/auth/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        // Validate input
        if (!name || !email || !password) {
            return res.status(400).json({ error: "Name, email, and password are required" });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters long" });
        }
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            if (existingUser.authType === 'google') {
                return res.status(400).json({ 
                    error: "This email is already registered with Google", 
                    message: "Please sign in with Google" 
                });
            }
            return res.status(400).json({ error: "Email already registered" });
        }
        
        // Create new user
        const user = new User({
            name,
            email,
            password,
            authType: 'email'
        });
        
        // Generate verification code
        const verificationCode = user.generateVerificationCode();
        
        // Save user to database
        await user.save();
        
        // Send verification email
        await sendVerificationEmail(email, verificationCode, name);
        
        res.status(201).json({ 
            message: "Registration successful! Please check your email for verification code.",
            email: email
        });
    } catch (err) {
        console.error("Registration error:", err);
        res.status(500).json({ error: "Registration failed", details: err.message });
    }
});

// Resend verification code
router.post("/auth/resend-verification", async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }
        
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Check if user is already verified
        if (user.isVerified) {
            return res.status(400).json({ error: "Email is already verified" });
        }
        
        // Generate a new verification code
        const verificationCode = user.generateVerificationCode();
        await user.save();
        
        // Send verification email
        await sendVerificationEmail(email, verificationCode, user.name);
        
        res.status(200).json({ message: "Verification code sent successfully" });
    } catch (err) {
        console.error("Resend verification error:", err);
        res.status(500).json({ error: "Failed to resend verification code" });
    }
});

// Verify email
router.post("/auth/verify-email", async (req, res) => {
    try {
        const { email, code } = req.body;
        
        // Validate input
        if (!email || !code) {
            return res.status(400).json({ error: "Email and verification code are required" });
        }
        
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Check if user is already verified
        if (user.isVerified) {
            // Generate JWT token for already verified users
            const token = jwt.sign(
                { userId: user._id, email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );
            
            return res.status(200).json({
                message: "Email already verified",
                token,
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    profilePicture: user.profilePicture
                }
            });
        }
        
        // Check if verification code exists and is valid
        if (!user.verificationCode || !user.verificationCode.code) {
            // Generate new verification code
            const verificationCode = user.generateVerificationCode();
            await user.save();
            
            // Send verification email
            await sendVerificationEmail(email, verificationCode, user.name);
            
            return res.status(400).json({ 
                error: "No verification code found. A new code has been sent to your email." 
            });
        }
        
        // Check if verification code has expired
        if (new Date() > new Date(user.verificationCode.expiresAt)) {
            // Generate a new verification code
            const verificationCode = user.generateVerificationCode();
            await user.save();
            
            // Send verification email
            await sendVerificationEmail(email, verificationCode, user.name);
            
            return res.status(400).json({ 
                error: "Verification code expired. A new code has been sent to your email." 
            });
        }
        
        // Check if verification code matches
        if (user.verificationCode.code !== code.toString()) {
            console.log("Code mismatch:", user.verificationCode.code, code, typeof user.verificationCode.code, typeof code);
            return res.status(400).json({ error: "Invalid verification code" });
        }
        
        // Mark user as verified
        user.isVerified = true;
        user.verificationCode = undefined;
        await user.save();
        
        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.status(200).json({
            message: "Email verified successfully",
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                profilePicture: user.profilePicture
            }
        });
    } catch (err) {
        console.error("Email verification error:", err);
        res.status(500).json({ error: "Email verification failed", details: err.message });
    }
});

// Login user
router.post("/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }
        
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // For Google auth users, suggest using Google login
        if (user.authType === 'google') {
            return res.status(400).json({ 
                error: "This account uses Google authentication", 
                message: "Please sign in with Google" 
            });
        }
        
        // Check if user is verified (for email auth type)
        if (!user.isVerified) {
            // Generate a new verification code
            const verificationCode = user.generateVerificationCode();
            await user.save();
            
            // Send verification email
            await sendVerificationEmail(email, verificationCode, user.name);
            
            return res.status(401).json({ 
                error: "Email not verified", 
                message: "A new verification code has been sent to your email" 
            });
        }
        
        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.status(200).json({
            token,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                profilePicture: user.profilePicture
            }
        });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Login failed", details: err.message });
    }
});

// Logout user
router.post("/auth/logout", (req, res) => {
    // JWT is stateless, so we just return success
    // The frontend will handle removing the token
    res.status(200).json({ message: "Logged out successfully" });
});

// Get current user
router.get("/auth/me", async (req, res) => {
    try {
        // Get token from header
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(401).json({ error: "No token provided" });
        }
        
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Find user
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        res.status(200).json({
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                profilePicture: user.profilePicture
            }
        });
    } catch (err) {
        console.error("Get user error:", err);
        res.status(401).json({ error: "Invalid token" });
    }
});

// Google OAuth routes
router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// This route must match exactly what's registered in Google Console
router.get("/auth/google/callback", 
    passport.authenticate("google", { session: true, failureRedirect: "/login" }),
    (req, res) => {
        try {
            console.log("Google auth callback successful for user:", req.user.email);
            
            // Generate JWT token
            const token = jwt.sign(
                { userId: req.user._id, email: req.user.email },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );
            
            // Redirect directly to the main app page with token
            res.redirect(`${process.env.FRONTEND_URL}/?token=${token}`);
        } catch (err) {
            console.error("Google auth callback error:", err);
            res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
        }
    }
);

export default router;