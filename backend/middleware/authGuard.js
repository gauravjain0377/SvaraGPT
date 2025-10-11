import { verifyToken } from "../utils/tokens.js";
import User from "../models/User.js";

export async function authGuard(req, res, next) {
    const token = req.cookies.svara_access;

    if (!token) {
        return res.status(401).json({ error: "Authentication required" });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
    
    try {
        const user = await User.findById(decoded.sub);
        if (!user) {
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