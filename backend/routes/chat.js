import express from "express";
import Thread from "../models/Thread.js";
import GuestUsage from "../models/GuestUsage.js";
import { GoogleGenAI } from "@google/genai";
import getGeminiResponse from "../utils/gemini.js";
import getGitHubModelsResponse from "../utils/githubModels.js";
import { guestOrAuthGuard, checkGuestLimit } from "../middleware/guestOrAuthGuard.js";

const router = express.Router();

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

    if (!threadId || !message) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        // Use findOneAndUpdate with upsert to prevent race conditions
        // This will either find an existing thread or create a new one atomically
        const thread = await Thread.findOneAndUpdate(
            { threadId, userId: req.userId },
            { 
                $setOnInsert: {
                    threadId,
                    userId: req.userId,
                    title: message.substring(0, 100), // Limit title length
                    createdAt: new Date()
                },
                $set: {
                    updatedAt: new Date()
                },
                $push: {
                    messages: { role: "user", content: message }
                }
            },
            { 
                new: true, // Return the updated document
                upsert: true, // Create if it doesn't exist
                runValidators: true
            }
        );

        // If projectId is provided, ensure thread is associated with project
        if (projectId && !thread.projectIds.includes(projectId)) {
            thread.projectIds.push(projectId);
        }
       
        const assistantReply = await getFastestResponse(message);

        // Update the thread with the assistant's reply
        thread.messages.push({ role: "assistant", content: assistantReply });
        thread.lastMessageAt = new Date();

        await thread.save();

        // Increment guest usage count if guest
        if (req.guestUsage) {
            req.guestUsage.totalMessages += 1;
            req.guestUsage.updatedAt = new Date();
            await req.guestUsage.save();
        }

        res.json({ reply: assistantReply });
    } catch (err) {
        console.error("Chat endpoint error:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Failed to generate response", details: err.message });
    }
});

export default router;
