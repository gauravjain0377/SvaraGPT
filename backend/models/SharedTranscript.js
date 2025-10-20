import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const SharedTranscriptSchema = new mongoose.Schema({
    token: {
        type: String,
        default: () => uuidv4().replace(/-/g, "") + uuidv4().replace(/-/g, ""),
        unique: true,
        index: true
    },
    threadId: {
        type: String,
        required: true,
        index: true
    },
    ownerId: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
        index: true
    },
    messagesSnapshot: {
        type: [
            {
                messageId: String,
                role: String,
                content: String,
                timestamp: Date,
                edited: Boolean,
                feedback: String,
                metadata: mongoose.Schema.Types.Mixed
            }
        ],
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    revokedAt: {
        type: Date,
        default: null
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: {
        createdAt: "createdAt",
        updatedAt: "updatedAt"
    }
});

SharedTranscriptSchema.methods.revoke = function() {
    this.revokedAt = new Date();
    return this.save();
};

export default mongoose.model("SharedTranscript", SharedTranscriptSchema);