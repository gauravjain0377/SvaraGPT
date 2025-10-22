import mongoose from "mongoose";

const RefreshTokenSchema = new mongoose.Schema(
    {
        token: { type: String, required: true },
        userAgent: { type: String, default: "unknown" },
        ip: { type: String, default: "unknown" },
        device: { type: String, default: "unknown" },
        browser: { type: String, default: "unknown" },
        os: { type: String, default: "unknown" },
        location: { type: String, default: "unknown" },
        country: { type: String, default: "Unknown" },
        countryCode: { type: String, default: "XX" },
        city: { type: String, default: "Unknown" },
        createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 14 },
        lastActive: { type: Date, default: Date.now },
    },
    { _id: false }
);

const UserSchema = new mongoose.Schema(
    {
        email: { type: String, required: true, unique: true, lowercase: true },
        name: { type: String, required: true, trim: true },
        passwordHash: { type: String },
        googleId: { type: String },
        isVerified: { type: Boolean, default: false },
        verificationCode: { type: String },
        verificationExpires: { type: Date },
        refreshTokens: [RefreshTokenSchema],
        twoFactorSecret: { type: String },
        twoFactorEnabled: { type: Boolean, default: false },
        twoFactorBackupCodes: [{ type: String }],
        passwordResetCode: { type: String },
        passwordResetExpires: { type: Date },
    },
    { timestamps: true }
);

UserSchema.methods.profile = function profile() {
    return {
        id: this._id,
        email: this.email,
        name: this.name,
        isVerified: this.isVerified,
        provider: this.googleId ? "google" : "local",
        twoFactorEnabled: this.twoFactorEnabled || false,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
    };
};

export default mongoose.model("User", UserSchema);