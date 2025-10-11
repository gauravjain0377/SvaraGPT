import { verifyToken } from "../utils/tokens.js";
import User from "../models/User.js";
import Thread from "../models/Thread.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Middleware that allows both authenticated users and guest users
 * - If valid token exists: sets req.userId and req.user (authenticated)
 * - If no token or invalid: creates/uses guest ID from cookie (guest mode)
 * - Guest IDs are prefixed with 'guest_' to distinguish from real user IDs
 * - Guests have a limit of 3 prompts total
 */
export async function guestOrAuthGuard(req, res, next) {
    const token = req.cookies.svara_access;

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
        res.cookie('svara_guest_id', guestId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
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
        // Count total messages sent by this guest across all threads
        const threads = await Thread.find({ userId: req.userId });
        
        let totalPrompts = 0;
        threads.forEach(thread => {
            // Count only user messages (not assistant responses)
            const userMessages = thread.messages.filter(msg => msg.role === 'user');
            totalPrompts += userMessages.length;
        });

        // Guest limit is 3 prompts
        if (totalPrompts >= 3) {
            return res.status(403).json({ 
                error: "Guest limit reached",
                message: "You've used all 3 free prompts. Please login or register to continue.",
                limitReached: true
            });
        }

        // Pass remaining prompts to the route
        req.guestPromptsRemaining = 3 - totalPrompts;
        next();
    } catch (error) {
        console.error("❌ [GUEST LIMIT CHECK] Error:", error);
        // On error, allow the request to proceed
        next();
    }
}