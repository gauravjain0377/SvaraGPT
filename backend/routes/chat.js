import express from "express";
import Thread from "../models/Thread.js";
import { GoogleGenAI } from "@google/genai";
import getGeminiResponse from "../utils/gemini.js";
import getGitHubModelsResponse from "../utils/githubModels.js";

const router = express.Router();

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
        const threads = await Thread.find({}).sort({ updatedAt: -1 });  // most recent chat on the top
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
        const thread = await Thread.findOne({ threadId });

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
            { threadId },
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
        const deletedThread = await Thread.findOneAndDelete({ threadId });

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
    const { threadId, message } = req.body;

    if (!threadId || !message) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        let thread = await Thread.findOne({ threadId });

        if (!thread) {
            // Create a new thread in DB
            thread = new Thread({
                threadId,
                title: message,
                messages: [{ role: "user", content: message }]
            });
        } else {
            thread.messages.push({ role: "user", content: message });
        }

        console.log(" Fetching AI response for message:", message);
        const assistantReply = await getFastestResponse(message);
        console.log(" AI response received:", assistantReply.substring(0, 100) + "...");

        thread.messages.push({ role: "assistant", content: assistantReply });
        thread.updatedAt = new Date();

        await thread.save();
        res.json({ reply: assistantReply });
    } catch (err) {
        console.error("Chat endpoint error:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Failed to generate response", details: err.message });
    }
});

export default router;