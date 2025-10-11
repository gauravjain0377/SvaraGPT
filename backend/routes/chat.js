import express from "express";
import Thread from "../models/Thread.js";
import { GoogleGenAI } from "@google/genai";
import getGeminiResponse from "../utils/gemini.js";
import getGitHubModelsResponse from "../utils/githubModels.js";
import { authGuard } from "../middleware/authGuard.js";

const router = express.Router();

// Apply auth guard to all routes
router.use(authGuard);

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

// Race Gemini and GitHub Models; return first successful text
async function getFastestResponse(message) {
    const attempts = [
        getGeminiResponse(message).then(text => ({ provider: "gemini", text })).catch(err => { throw { provider: "gemini", err }; }),
        getGitHubModelsResponse(message).then(text => ({ provider: "github_models", text })).catch(err => { throw { provider: "github_models", err }; })
    ];

    try {
        const winner = await Promise.any(attempts);
        return winner.text;
    } catch (aggregateError) {
        // If both failed, surface a combined message
        const details = aggregateError?.errors?.map(e => `${e.provider}: ${e.err?.message || e}`).join(" | ") || String(aggregateError);
        throw new Error(`All providers failed: ${details}`);
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

// Chat endpoint
router.post("/chat", async (req, res) => {
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
        res.json({ reply: assistantReply });
    } catch (err) {
        console.error("Chat endpoint error:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Failed to generate response", details: err.message });
    }
});

export default router;