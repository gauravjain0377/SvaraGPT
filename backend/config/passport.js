import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:8080/auth/google/callback",
            passReqToCallback: true,
            proxy: true,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails[0].value;
                const googleId = profile.id;
                const name = profile.displayName;

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