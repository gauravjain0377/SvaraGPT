import { verifyToken } from "../utils/tokens.js";
import User from "../models/User.js";
import Thread from "../models/Thread.js";
import GuestUsage from "../models/GuestUsage.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Middleware that allows both authenticated users and guest users
 * - If valid token exists: sets req.userId and req.user (authenticated)
 * - If no token or invalid: creates/uses guest ID from cookie (guest mode)
 * - Guest IDs are prefixed with 'guest_' to distinguish from real user IDs
 * - Guests have a limit of 3 prompts total
 */
export async function guestOrAuthGuard(req, res, next) {
    let token = req.cookies.svara_access;

    // Also support Authorization header (Bearer token) for environments where cookies are blocked
    if (!token && req.headers.authorization) {
        const [scheme, credentials] = req.headers.authorization.split(" ");
        if (scheme === "Bearer" && credentials) {
            token = credentials;
        }
    }

    // Try to authenticate with token
    if (token) {
        const decoded = verifyToken(token);
        if (decoded) {
            try {
                const user = await User.findById(decoded.sub);
                if (user) {
                    // Authenticated user
                    req.user = user;
                    req.userId = decoded.sub;
                    req.isGuest = false;
                    return next();
                }
            } catch (error) {
                console.error("❌ [GUEST/AUTH GUARD] Error verifying user:", error);
            }
        }
    }

    // Guest mode: create or use existing guest ID
    let guestId = req.cookies.svara_guest_id;
    
    if (!guestId) {
        // Generate new guest ID
        guestId = `guest_${uuidv4()}`;
        // Set cookie that expires in 30 days
        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('svara_guest_id', guestId, {
            httpOnly: true,
            secure: process.env.COOKIE_SECURE === 'true' || isProduction, // required for cross-site cookies
            sameSite: process.env.COOKIE_SAME_SITE || 'none', // allow cross-site between Vercel and Render
            path: '/',
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            domain: process.env.COOKIE_DOMAIN || undefined // Don't set domain for cross-domain cookies
        });
    }

    req.userId = guestId;
    req.isGuest = true;
    req.user = null;
    next();
}

/**
 * Middleware to check guest prompt limit (3 prompts max)
 * Should be used on POST /api/chat route
 */
export async function checkGuestLimit(req, res, next) {
    // Skip check for authenticated users
    if (!req.isGuest) {
        return next();
    }

    try {
        // Get or create guest usage
        let guestUsage = await GuestUsage.findOne({ guestId: req.userId });
        if (!guestUsage) {
            guestUsage = new GuestUsage({ guestId: req.userId, totalMessages: 0 });
            await guestUsage.save();
        }

        // Guest limit is 3 prompts
        if (guestUsage.totalMessages >= 3) {
            return res.status(403).json({
                error: "Guest limit reached",
                message: "You've used all 3 free prompts. Please login or register to continue.",
                limitReached: true
            });
        }

        // Pass remaining prompts to the route
        req.guestPromptsRemaining = 3 - guestUsage.totalMessages;
        req.guestUsage = guestUsage; // Pass to route for increment
        next();
    } catch (error) {
        console.error("❌ [GUEST LIMIT CHECK] Error:", error);
        // On error, allow the request to proceed
        next();
    }
}