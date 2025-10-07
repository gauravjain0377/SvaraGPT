import express from "express";
import Project from "../models/Project.js";

const router = express.Router();

// Get all projects
router.get("/projects", async (req, res) => {
    try {
        const projects = await Project.find({}).sort({ createdAt: -1 });
        res.json(projects);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to fetch projects" });
    }
});

// Create project
router.post("/projects", async (req, res) => {
    const { id, name } = req.body;
    if (!id || !name) return res.status(400).json({ error: "Missing id or name" });
    try {
        const project = new Project({ id, name });
        await project.save();
        res.status(201).json(project);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to create project" });
    }
});

// Rename project
router.put("/projects/:id", async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    try {
        const updated = await Project.findOneAndUpdate({ id }, { name }, { new: true });
        if (!updated) return res.status(404).json({ error: "Project not found" });
        res.json(updated);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to rename project" });
    }
});

// Delete project
router.delete("/projects/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const deleted = await Project.findOneAndDelete({ id });
        if (!deleted) return res.status(404).json({ error: "Project not found" });
        res.json({ success: true });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to delete project" });
    }
});

// Add chat to project
router.post("/projects/:id/chats", async (req, res) => {
    const { id } = req.params;
    const { threadId, title } = req.body;
    if (!threadId || !title) return res.status(400).json({ error: "Missing chat fields" });
    try {
        const updated = await Project.findOneAndUpdate(
            { id },
            { $addToSet: { chats: { threadId, title } } },
            { new: true }
        );
        if (!updated) return res.status(404).json({ error: "Project not found" });
        res.json(updated);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to add chat to project" });
    }
});

// Remove chat from project
router.delete("/projects/:id/chats/:threadId", async (req, res) => {
    const { id, threadId } = req.params;
    try {
        const updated = await Project.findOneAndUpdate(
            { id },
            { $pull: { chats: { threadId } } },
            { new: true }
        );
        if (!updated) return res.status(404).json({ error: "Project not found" });
        res.json(updated);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to remove chat from project" });
    }
});

// Rename a chat title within a project
router.put("/projects/:id/chats/:threadId", async (req, res) => {
    const { id, threadId } = req.params;
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: "Missing title" });
    try {
        const updated = await Project.findOneAndUpdate(
            { id, "chats.threadId": threadId },
            { $set: { "chats.$.title": title } },
            { new: true }
        );
        if (!updated) return res.status(404).json({ error: "Project or chat not found" });
        res.json(updated);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to rename project chat" });
    }
});

export default router;


