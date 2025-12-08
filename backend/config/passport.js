import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

console.log('🔑 [PASSPORT] Initializing Google OAuth strategy');
console.log('🔑 [PASSPORT] GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '[SET]' : '[NOT SET]');
console.log('🔑 [PASSPORT] GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '[SET]' : '[NOT SET]');
console.log('🔑 [PASSPORT] GOOGLE_CALLBACK_URL:', process.env.GOOGLE_CALLBACK_URL || "http://localhost:8080/auth/google/callback");

// We'll initialize the strategy when needed to ensure environment variables are loaded
let googleStrategyInitialized = false;

function initializeGoogleStrategy() {
    if (googleStrategyInitialized) {
        return;
    }
    
    console.log('🔑 [PASSPORT] Initializing GoogleStrategy with current env vars:');
    console.log('🔑 [PASSPORT]   clientID:', process.env.GOOGLE_CLIENT_ID ? '[SET]' : '[NOT SET]');
    console.log('🔑 [PASSPORT]   clientSecret:', process.env.GOOGLE_CLIENT_SECRET ? '[SET]' : '[NOT SET]');
    console.log('🔑 [PASSPORT]   callbackURL:', process.env.GOOGLE_CALLBACK_URL || "http://localhost:8080/auth/google/callback");
    
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
                console.log('🔑 [PASSPORT] Google OAuth strategy initiated');
                console.log('🔑 [PASSPORT] Callback URL being used:', process.env.GOOGLE_CALLBACK_URL || "http://localhost:8080/auth/google/callback");
                console.log('🔑 [PASSPORT] Request details:', { 
                    url: req.url, 
                    query: req.query, 
                    headers: req.headers 
                });
                try {
                    // Check if profile and emails exist
                    if (!profile || !profile.emails || !profile.emails.length) {
                        console.error("❌ [PASSPORT] Error: Invalid profile data", profile);
                        return done(new Error("Invalid profile data from Google"), null);
                    }
                    
                    const email = profile.emails[0].value;
                    const googleId = profile.id;
                    const name = profile.displayName || email.split('@')[0];

                    let user = await User.findOne({ $or: [{ googleId }, { email }] });

                    if (user) {
                        if (!user.googleId) {
                            user.googleId = googleId;
                            user.isVerified = true;
                            await user.save();
                        }
                    } else {
                        user = await User.create({
                            email,
                            name,
                            googleId,
                            isVerified: true,
                        });
                    }

                    return done(null, user);
                } catch (error) {
                    console.error("❌ [PASSPORT] Error:", error);
                    return done(error, null);
                }
            }
        )
    );
    
    googleStrategyInitialized = true;
}

// Initialize the strategy immediately
initializeGoogleStrategy();

passport.serializeUser((user, done) => {
    done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        console.error("❌ [PASSPORT] Deserialize error:", error);
        done(error, null);
    }
});

export default passport;
export { initializeGoogleStrategy };