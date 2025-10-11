import mongoose from "mongoose";

const RefreshTokenSchema = new mongoose.Schema(
    {
        token: { type: String, required: true },
        userAgent: { type: String, default: "unknown" },
        createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 14 },
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
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
    };
};

export default mongoose.model("User", UserSchema);