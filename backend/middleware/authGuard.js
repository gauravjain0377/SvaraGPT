import { verifyToken } from "../utils/tokens.js";
import User from "../models/User.js";

export async function authGuard(req, res, next) {
    const token = req.cookies.svara_access;

    if (!token) {
        console.warn("[AUTH GUARD] Missing access token cookie", {
            cookiesPresent: Object.keys(req.cookies || {}).length > 0,
            cookieNames: Object.keys(req.cookies || {}),
            origin: req.headers.origin,
            referer: req.headers.referer,
            rawCookieHeader: req.headers.cookie || "<none>",
            forwardedFor: req.headers["x-forwarded-for"],
            secure: req.secure,
            protocol: req.protocol,
            hostname: req.hostname,
            trustProxy: req.app?.get("trust proxy"),
        });
        return res.status(401).json({ error: "Authentication required" });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        console.warn("[AUTH GUARD] Invalid or expired token", {
            origin: req.headers.origin,
            cookieLength: token?.length,
        });
        return res.status(401).json({ error: "Invalid or expired token" });
    }
    
    try {
        const user = await User.findById(decoded.sub);
        if (!user) {
            console.warn("[AUTH GUARD] User not found for token", {
                userId: decoded.sub,
            });
            return res.status(401).json({ error: "User not found" });
        }
        
        req.user = user;
        req.userId = decoded.sub;
        next();
    } catch (error) {
        console.error("❌ [AUTH GUARD] Error:", error);
        return res.status(500).json({ error: "Authentication error" });
    }
}