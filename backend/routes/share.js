import express from "express";
import Thread from "../models/Thread.js";
import SharedTranscript from "../models/SharedTranscript.js";
import { guestOrAuthGuard } from "../middleware/guestOrAuthGuard.js";
import { sendShareEmail } from "../utils/mailer.js";

const router = express.Router();

router.use(guestOrAuthGuard);

const buildSnapshot = (thread) => {
    return thread.messages.map(msg => ({
        messageId: msg.messageId,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        edited: msg.edited,
        feedback: msg.feedback,
        metadata: msg.metadata || {}
    }));
};

router.post("/share/thread", async (req, res) => {
    const { threadId } = req.body;

    if (!threadId) {
        return res.status(400).json({ error: "threadId is required" });
    }

    try {
        const thread = await Thread.findOne({ threadId, userId: req.userId });

        if (!thread) {
            return res.status(404).json({ error: "Thread not found" });
        }

        const snapshot = buildSnapshot(thread);

        const shared = await SharedTranscript.create({
            threadId,
            ownerId: req.userId,
            messagesSnapshot: snapshot
        });

        res.json({
            token: shared.token,
            url: `${process.env.FRONTEND_URL?.replace(/\/?$/, "") || "https://svaragpt.vercel.app"}/share/${shared.token}`,
            createdAt: shared.createdAt
        });
    } catch (err) {
        console.error("Share creation error:", err.message);
        res.status(500).json({ error: "Failed to create share", details: err.message });
    }
});

router.get("/share/:token", async (req, res) => {
    try {
        const shared = await SharedTranscript.findOne({ token: req.params.token });

        if (!shared || shared.revokedAt) {
            return res.status(410).json({ error: "Share link revoked or expired" });
        }

        res.json({
            threadId: shared.threadId,
            messages: shared.messagesSnapshot,
            createdAt: shared.createdAt
        });
    } catch (err) {
        console.error("Share fetch error:", err.message);
        res.status(500).json({ error: "Failed to fetch share", details: err.message });
    }
});

router.delete("/share/:token", async (req, res) => {
    try {
        const shared = await SharedTranscript.findOne({ token: req.params.token, ownerId: req.userId });

        if (!shared) {
            return res.status(404).json({ error: "Share link not found" });
        }

        if (!shared.revokedAt) {
            await shared.revoke();
        }

        res.json({ success: true, revokedAt: shared.revokedAt });
    } catch (err) {
        console.error("Share revoke error:", err.message);
        res.status(500).json({ error: "Failed to revoke share", details: err.message });
    }
});

router.post("/share/:token/email", async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: "Email is required" });
    }

    try {
        const shared = await SharedTranscript.findOne({ token: req.params.token, ownerId: req.userId });

        if (!shared || shared.revokedAt) {
            return res.status(404).json({ error: "Share link missing or revoked" });
        }

        const url = `${process.env.FRONTEND_URL?.replace(/\/?$/, "") || "https://svaragpt.vercel.app"}/share/${shared.token}`;

        await sendShareEmail(email, url, shared.messagesSnapshot);

        res.json({ success: true });
    } catch (err) {
        console.error("Share email error:", err.message);
        res.status(500).json({ error: "Failed to send email", details: err.message });
    }
});

export default router;