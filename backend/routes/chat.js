import express from "express";
import Thread from "../models/Thread.js";
import GuestUsage from "../models/GuestUsage.js";
import { GoogleGenAI } from "@google/genai";
import getGeminiResponse from "../utils/gemini.js";
import getGitHubModelsResponse from "../utils/githubModels.js";
import { guestOrAuthGuard, checkGuestLimit } from "../middleware/guestOrAuthGuard.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

// Error handler for duplicate key errors
const handleDuplicateKeyError = async (err, req, res, next) => {
  if (err.name === 'MongoServerError' && err.code === 11000) {
    console.log('Handling duplicate key error:', err.keyValue);
    // Generate a new unique threadId
    const newThreadId = uuidv4();
    return { newThreadId, isDuplicate: true };
  }
  throw err;
};

// Apply guest or auth guard to all routes (allows both authenticated and guest users)
router.use(guestOrAuthGuard);

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

// Race Gemini and GitHub Models; return first successful text
async function getFastestResponse(message) {
    // Try providers in parallel first
    const attempts = [
        getGeminiResponse(message)
            .then(text => ({ provider: "gemini", text, success: true }))
            .catch(err => ({ provider: "gemini", error: err.message, success: false })),
        getGitHubModelsResponse(message)
            .then(text => ({ provider: "github_models", text, success: true }))
            .catch(err => ({ provider: "github_models", error: err.message, success: false }))
    ];

    try {
        // Wait for first successful response
        const results = await Promise.race([
            Promise.all(attempts).then(results => {
                const successful = results.find(r => r.success);
                if (successful) return successful;
                throw new Error("All providers failed in parallel");
            }),
            // Also race each individual promise
            ...attempts.map(p => p.then(r => r.success ? r : Promise.reject(r)))
        ]);
        
        console.log(`✅ Response from ${results.provider}`);
        return results.text;
    } catch (error) {
        // All parallel attempts failed, try sequential fallback
        console.log("⚠️  Parallel attempts failed, trying sequential fallback...");
        
        // Try Gemini first
        try {
            const geminiText = await getGeminiResponse(message);
            console.log("✅ Gemini fallback successful");
            return geminiText;
        } catch (geminiErr) {
            console.log(`❌ Gemini failed: ${geminiErr.message}`);
        }

        // Try GitHub Models as last resort
        try {
            const githubText = await getGitHubModelsResponse(message);
            console.log("✅ GitHub Models fallback successful");
            return githubText;
        } catch (githubErr) {
            console.log(`❌ GitHub Models failed: ${githubErr.message}`);
        }

        // If everything fails, provide helpful error
        throw new Error("All AI providers are currently unavailable. Please try again in a moment.");
    }
}

// Test route
// router.post("/test", async (req, res) => {
//     try {
//         const thread = new Thread({
//             threadId: "12345",
//             title: "Testing New Thread"
//         });

//         const response = await thread.save();
//         res.send(response);
//     } catch (err) {
//         console.log(err);
//         res.status(500).json({ error: "Failed to save in DB" });
//     }
// });


// Get guest usage info
router.get("/guest-usage", async (req, res) => {
    try {
        if (!req.isGuest) {
            return res.json({ isGuest: false, promptsUsed: 0, promptsRemaining: Infinity });
        }

        let guestUsage = await GuestUsage.findOne({ guestId: req.userId });
        if (!guestUsage) {
            guestUsage = { totalMessages: 0 };
        }

        res.json({
            isGuest: true,
            promptsUsed: guestUsage.totalMessages,
            promptsRemaining: Math.max(0, 3 - guestUsage.totalMessages),
            limitReached: guestUsage.totalMessages >= 3
        });
    } catch (err) {
        console.error("Error fetching guest usage:", err);
        res.status(500).json({ error: "Failed to fetch usage info" });
    }
});

// Get all threads
router.get("/thread", async (req, res) => {
    try {
        const threads = await Thread.find({ userId: req.userId }).sort({ updatedAt: -1 });  // most recent chat on the top
        res.json(threads);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to fetch threads" });
    }
});

// Get specific thread
router.get("/thread/:threadId", async (req, res) => {
    const { threadId } = req.params;

    try {
        const thread = await Thread.findOne({ threadId, userId: req.userId });

        if (!thread) {
            return res.status(404).json({ error: "Thread not found" });
        }

        res.json(thread.messages);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to fetch chat" });
    }
});

// Rename/update thread title
router.put("/thread/:threadId", async (req, res) => {
    const { threadId } = req.params;
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: "Missing title" });

    try {
        const updated = await Thread.findOneAndUpdate(
            { threadId, userId: req.userId },
            { title, updatedAt: new Date() },
            { new: true }
        );
        if (!updated) return res.status(404).json({ error: "Thread not found" });
        res.json(updated);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to rename thread" });
    }
});

// Delete thread
router.delete("/thread/:threadId", async (req, res) => {
    const { threadId } = req.params;

    try {
        const deletedThread = await Thread.findOneAndDelete({ threadId, userId: req.userId });

        if (!deletedThread) {
            return res.status(404).json({ error: "Thread not found" });
        }

        res.status(200).json({ success: "Thread deleted successfully" });
    } catch (err) {
        console.error("Error deleting thread:", err);
        res.status(500).json({ error: "Failed to delete thread" });
    }
});

// Chat endpoint (with guest limit check)
router.post("/chat", checkGuestLimit, async (req, res) => {
    const { threadId, message, projectId } = req.body;

    console.log(`📨 Chat request received - User: ${req.isGuest ? 'Guest' : 'Authenticated'} (${req.userId}), Thread: ${threadId}, Message length: ${message?.length || 0}`);

    if (!threadId || !message) {
        console.error("❌ Missing required fields - threadId:", !!threadId, "message:", !!message);
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        let thread;
        let userMessage;

        try {
            thread = await Thread.findOne({ threadId, userId: req.userId });

            if (!thread) {
                thread = new Thread({
                    threadId,
                    userId: req.userId,
                    title: message.substring(0, 100),
                    messages: [],
                    projectIds: projectId ? [projectId] : []
                });
            } else if (projectId && !thread.projectIds.includes(projectId)) {
                thread.projectIds.push(projectId);
            }

            userMessage = {
                messageId: uuidv4(),
                role: "user",
                content: message,
                timestamp: new Date()
            };

            thread.messages.push(userMessage);
            thread.updatedAt = new Date();
            await thread.save();
        } catch (err) {
            if (err.name === 'MongoServerError' && err.code === 11000) {
                console.log('Handling duplicate key error:', err.keyValue);
                const newThreadId = uuidv4();
                console.log(`Generated new threadId: ${newThreadId} to replace duplicate: ${threadId}`);
                thread = await Thread.create({
                    threadId: newThreadId,
                    userId: req.userId,
                    title: message.substring(0, 100),
                    messages: [{
                        messageId: uuidv4(),
                        role: "user",
                        content: message,
                        timestamp: new Date()
                    }],
                    projectIds: projectId ? [projectId] : []
                });
                userMessage = thread.messages[thread.messages.length - 1];
            } else {
                throw err;
            }
        }

        console.log("🤖 Generating AI response...");
        const assistantReply = await getFastestResponse(message);
        console.log(`✅ AI response generated (length: ${assistantReply?.length || 0})`);

        if (!assistantReply || assistantReply.trim().length === 0) {
            throw new Error("Empty response from AI provider");
        }

        const assistantMessage = {
            messageId: uuidv4(),
            role: "assistant",
            content: assistantReply,
            timestamp: new Date(),
            parentMessageId: userMessage?.messageId || null
        };

        thread.messages.push(assistantMessage);
        thread.lastMessageAt = new Date();
        await thread.save();
        console.log("💾 Thread saved successfully");

        if (req.guestUsage) {
            req.guestUsage.totalMessages += 1;
            req.guestUsage.updatedAt = new Date();
            await req.guestUsage.save();
            console.log(`👤 Guest usage updated: ${req.guestUsage.totalMessages}/3`);
        }

        console.log("✅ Sending response to client");
        res.json({
            reply: assistantReply,
            threadId: thread.threadId,
            userMessage,
            assistantMessage
        });
    } catch (err) {
        console.error("❌ Chat endpoint error:", err.message);
        console.error("❌ Full error stack:", err.stack);
        console.error("❌ Error details:", {
            name: err.name,
            message: err.message,
            code: err.code
        });
        res.status(500).json({ 
            error: "Failed to generate response", 
            details: err.message,
            type: err.name || "UnknownError"
        });
    }
});

router.patch("/chat/:threadId/messages/:messageId", async (req, res) => {
    const { threadId, messageId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
        return res.status(400).json({ error: "Content is required" });
    }

    try {
        const thread = await Thread.findOne({ threadId, userId: req.userId });

        if (!thread) {
            return res.status(404).json({ error: "Thread not found" });
        }

        const messageIndex = thread.messages.findIndex(msg => msg.messageId === messageId && msg.role === "user");

        if (messageIndex === -1) {
            return res.status(404).json({ error: "Message not found" });
        }

        thread.messages[messageIndex].content = content;
        thread.messages[messageIndex].edited = true;
        thread.messages[messageIndex].timestamp = new Date();

        const assistantIndex = thread.messages.findIndex(msg => msg.parentMessageId === messageId && msg.role === "assistant");

        if (assistantIndex !== -1) {
            thread.messages.splice(assistantIndex, 1);
        }

        const assistantReply = await getFastestResponse(content);

        const assistantMessage = {
            messageId: uuidv4(),
            role: "assistant",
            content: assistantReply,
            timestamp: new Date(),
            parentMessageId: messageId
        };

        thread.messages.push(assistantMessage);
        thread.updatedAt = new Date();
        thread.lastMessageAt = new Date();
        await thread.save();

        res.json({
            userMessage: thread.messages[messageIndex],
            assistantMessage
        });
    } catch (err) {
        console.error("Edit message error:", err.message);
        res.status(500).json({ error: "Failed to edit message", details: err.message });
    }
});

router.post("/chat/:threadId/messages/:messageId/regenerate", async (req, res) => {
    const { threadId, messageId } = req.params;

    try {
        const thread = await Thread.findOne({ threadId, userId: req.userId });

        if (!thread) {
            return res.status(404).json({ error: "Thread not found" });
        }

        const message = thread.messages.find(msg => msg.messageId === messageId && msg.role === "user");

        if (!message) {
            return res.status(404).json({ error: "Message not found" });
        }

        const assistantIndex = thread.messages.findIndex(msg => msg.parentMessageId === messageId && msg.role === "assistant");

        if (assistantIndex === -1) {
            return res.status(404).json({ error: "Assistant reply not found" });
        }

        const assistantReply = await getFastestResponse(message.content);

        thread.messages[assistantIndex].content = assistantReply;
        thread.messages[assistantIndex].timestamp = new Date();
        thread.updatedAt = new Date();
        thread.lastMessageAt = new Date();

        await thread.save();

        res.json({ assistantMessage: thread.messages[assistantIndex] });
    } catch (err) {
        console.error("Regenerate message error:", err.message);
        res.status(500).json({ error: "Failed to regenerate response", details: err.message });
    }
});

router.post("/chat/:threadId/messages/:messageId/feedback", async (req, res) => {
    const { threadId, messageId } = req.params;
    const { rating } = req.body;

    if (!rating || !["good", "bad"].includes(rating)) {
        return res.status(400).json({ error: "Invalid rating" });
    }

    try {
        const thread = await Thread.findOne({ threadId, userId: req.userId });

        if (!thread) {
            return res.status(404).json({ error: "Thread not found" });
        }

        const messageIndex = thread.messages.findIndex(msg => msg.messageId === messageId && msg.role === "assistant");

        if (messageIndex === -1) {
            return res.status(404).json({ error: "Assistant message not found" });
        }

        thread.messages[messageIndex].feedback = rating;
        thread.messages[messageIndex].feedbackAt = new Date();
        thread.updatedAt = new Date();

        await thread.save();

        res.json({ message: thread.messages[messageIndex] });
    } catch (err) {
        console.error("Feedback error:", err.message);
        res.status(500).json({ error: "Failed to save feedback", details: err.message });
    }
});

export default router;
