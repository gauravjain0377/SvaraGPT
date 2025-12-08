import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

// Log configuration on startup
console.log("🔧 [PASSPORT] Configuring Google OAuth Strategy");
console.log("🔧 [PASSPORT] CLIENT_ID:", process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 20)}...` : "NOT SET");
console.log("🔧 [PASSPORT] CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET ? "SET (hidden)" : "NOT SET");
console.log("🔧 [PASSPORT] CALLBACK_URL:", process.env.GOOGLE_CALLBACK_URL || "NOT SET (using default)");

// Simple and clean Google OAuth strategy initialization
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:8080/auth/google/callback",
            passReqToCallback: true,
            proxy: true,
        },
        async (req, accessToken, refreshToken, profile, done) => {
            try {
                console.log("🔐 [PASSPORT] Google OAuth callback invoked");
                console.log("🔐 [PASSPORT] Profile received:", {
                    id: profile.id,
                    displayName: profile.displayName,
                    hasEmails: !!(profile.emails && profile.emails.length)
                });
                
                // Check if profile and emails exist
                if (!profile || !profile.emails || !profile.emails.length) {
                    console.error("❌ [PASSPORT] Invalid profile data from Google");
                    return done(new Error("Invalid profile data from Google"), null);
                }
                
                const email = profile.emails[0].value;
                const googleId = profile.id;
                const name = profile.displayName || email.split('@')[0];

                console.log("🔐 [PASSPORT] Looking for user:", email);
                let user = await User.findOne({ $or: [{ googleId }, { email }] });

                if (user) {
                    console.log("✅ [PASSPORT] Existing user found:", user._id);
                    if (!user.googleId) {
                        console.log("🔄 [PASSPORT] Linking Google ID to existing account");
                        user.googleId = googleId;
                        user.isVerified = true;
                        await user.save();
                    }
                } else {
                    console.log("➕ [PASSPORT] Creating new user for:", email);
                    user = await User.create({
                        email,
                        name,
                        googleId,
                        isVerified: true,
                    });
                    console.log("✅ [PASSPORT] New user created:", user._id);
                }

                console.log("✅ [PASSPORT] Authentication successful for:", email);
                return done(null, user);
            } catch (error) {
                console.error("❌ [PASSPORT] Error during authentication:", error);
                console.error("❌ [PASSPORT] Error stack:", error.stack);
                return done(error, null);
            }
        }
    )
);

console.log("✅ [PASSPORT] Google OAuth Strategy configured successfully");

passport.serializeUser((user, done) => {
    done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

export default passport;