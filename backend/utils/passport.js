import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";
import "dotenv/config";

const setupPassport = () => {
    // Ensure we have the required environment variables
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        console.error("Missing Google OAuth credentials in .env file");
        return;
    }

    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback",
                proxy: true
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    console.log("Google profile:", profile.id, profile.displayName, profile.emails[0].value);
                    
                    // Check if user already exists
                    let user = await User.findOne({ googleId: profile.id });
                    
                    if (user) {
                        // Update user info if needed
                        user.name = profile.displayName;
                        user.email = profile.emails[0].value;
                        if (profile.photos && profile.photos.length > 0) {
                            user.profilePicture = profile.photos[0].value;
                        }
                        await user.save();
                        return done(null, user);
                    }
                    
                    // Check if email already exists
                    user = await User.findOne({ email: profile.emails[0].value });
                    
                    if (user) {
                        // Link Google account to existing user
                        user.googleId = profile.id;
                        user.authType = 'google';
                        user.name = profile.displayName;
                        if (profile.photos && profile.photos.length > 0) {
                            user.profilePicture = profile.photos[0].value;
                        }
                        user.isVerified = true;
                        await user.save();
                        return done(null, user);
                    }
                    
                    // Create new user
                    const newUser = new User({
                        googleId: profile.id,
                        email: profile.emails[0].value,
                        name: profile.displayName,
                        profilePicture: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : "",
                        authType: 'google',
                        isVerified: true
                    });
                    
                    await newUser.save();
                    return done(null, newUser);
                } catch (err) {
                    console.error("Google auth error:", err);
                    return done(err, null);
                }
            }
        )
    );
    
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });
    
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    });
};

export default setupPassport;