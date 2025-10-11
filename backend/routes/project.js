import express from "express";
import Project from "../models/Project.js";
import Thread from "../models/Thread.js";
import { authGuard } from "../middleware/authGuard.js";

const router = express.Router();

// Apply auth guard to all routes
router.use(authGuard);

// Get all projects with optional filtering
router.get("/projects", async (req, res) => {
    try {
        const { includeInactive, search, limit, page } = req.query;
        const query = { userId: req.userId };
        
        // Filter by active status
        if (includeInactive !== 'true') {
            query.isActive = true;
        }
        
        // Search by project name
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }
        
        // Pagination
        const pageSize = parseInt(limit) || 10;
        const currentPage = parseInt(page) || 1;
        const skip = (currentPage - 1) * pageSize;
        
        const [projects, total] = await Promise.all([
            Project.find(query)
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(pageSize),
            Project.countDocuments(query)
        ]);
        
        res.json({
            data: projects,
            pagination: {
                total,
                page: currentPage,
                pages: Math.ceil(total / pageSize),
                limit: pageSize
            }
        });
    } catch (err) {
        console.error("Error fetching projects:", err);
        res.status(500).json({ error: "Failed to fetch projects" });
    }
});

// Create project
router.post("/projects", async (req, res) => {
    const { id, name, description = "" } = req.body;
    if (!id || !name) return res.status(400).json({ error: "Missing id or name" });
    
    try {
        const project = new Project({ 
            id,
            userId: req.userId,
            name, 
            description,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        await project.save();
        res.status(201).json(project);
    } catch (err) {
        console.error("Error creating project:", err);
        if (err.code === 11000) {
            return res.status(400).json({ error: "Project with this ID already exists" });
        }
        res.status(500).json({ error: "Failed to create project" });
    }
});

// Get project by ID
router.get("/projects/:id", async (req, res) => {
    try {
        const project = await Project.findOne({ id: req.params.id, userId: req.userId });
        if (!project) return res.status(404).json({ error: "Project not found" });
        res.json(project);
    } catch (err) {
        console.error("Error fetching project:", err);
        res.status(500).json({ error: "Failed to fetch project" });
    }
});

// Update project
router.put("/projects/:id", async (req, res) => {
    const { id } = req.params;
    const { name, description, isActive } = req.body;
    
    try {
        const update = { updatedAt: new Date() };
        if (name) update.name = name;
        if (description !== undefined) update.description = description;
        if (isActive !== undefined) update.isActive = isActive;
        
        const updated = await Project.findOneAndUpdate(
            { id, userId: req.userId },
            { $set: update },
            { new: true, runValidators: true }
        );
        
        if (!updated) return res.status(404).json({ error: "Project not found" });
        res.json(updated);
    } catch (err) {
        console.error("Error updating project:", err);
        if (err.code === 11000) {
            return res.status(400).json({ error: "Project with this name already exists" });
        }
        res.status(500).json({ error: "Failed to update project" });
    }
});

// Delete project (soft delete by default, or hard delete with query param)
router.delete("/projects/:id", async (req, res) => {
    const { id } = req.params;
    const { hardDelete } = req.query;
    
    try {
        let result;
        if (hardDelete === 'true') {
            // Hard delete (permanent removal)
            result = await Project.findOneAndDelete({ id, userId: req.userId });
        } else {
            // Soft delete (mark as inactive)
            result = await Project.findOneAndUpdate(
                { id, userId: req.userId },
                { isActive: false, updatedAt: new Date() },
                { new: true }
            );
        }
        
        if (!result) return res.status(404).json({ error: "Project not found" });
        
        res.json({ 
            success: true,
            message: hardDelete === 'true'
                ? "Project permanently deleted" 
                : "Project moved to trash"
        });
    } catch (err) {
        console.error("Error deleting project:", err);
        res.status(500).json({ 
            error: `Failed to ${hardDelete === 'true' ? 'delete' : 'move'} project` 
        });
    }
});

// Add or update chat in project
router.post("/projects/:id/chats", async (req, res) => {
    const { id } = req.params;
    const { threadId, title, isShared = false } = req.body;
    
    if (!threadId || !title) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    
    try {
        // Check if chat already exists in any project
        const existingChat = await Project.findOne({
            userId: req.userId,
            "chats.threadId": threadId,
            id: { $ne: id }
        });

        if (existingChat && !isShared) {
            return res.status(400).json({ 
                error: "Chat already exists in another project. Set isShared to true to add it to multiple projects." 
            });
        }

        // Check if chat exists in this project
        const existingInThisProject = await Project.findOne({
            userId: req.userId,
            id: id,
            "chats.threadId": threadId
        });

        let updated;
        
        if (existingInThisProject) {
            // Update existing chat
            updated = await Project.findOneAndUpdate(
                { id: id, userId: req.userId, "chats.threadId": threadId },
                { 
                    $set: { 
                        "chats.$": { 
                            threadId, 
                            title, 
                            projectId: id,
                            isShared,
                            lastModified: new Date() 
                        } 
                    },
                    $currentDate: { updatedAt: true }
                },
                { new: true }
            );
        } else {
            // Add new chat
            updated = await Project.findOneAndUpdate(
                { id: id, userId: req.userId },
                { 
                    $push: { 
                        chats: { 
                            threadId, 
                            title, 
                            projectId: id,
                            isShared,
                            lastModified: new Date() 
                        } 
                    },
                    $set: { updatedAt: new Date() }
                },
                { new: true, upsert: false }
            );
        }
        
        if (!updated) return res.status(404).json({ error: "Project not found" });
        
        // Update the thread's project reference if needed
        await Thread.findOneAndUpdate(
            { threadId, userId: req.userId },
            { $addToSet: { projectIds: id } },
            { upsert: false }
        );
        
        res.json(updated);
    } catch (err) {
        console.error("Error managing project chat:", err);
        res.status(500).json({ error: "Failed to manage project chat" });
    }
});

// Move chat between projects
router.post("/projects/move-chat", async (req, res) => {
    const { sourceProjectId, targetProjectId, threadId, makeCopy = false } = req.body;
    
    if (!sourceProjectId || !targetProjectId || !threadId) {
        return res.status(400).json({ error: "Missing required fields" });
    }
    
    try {
        // Get the chat details from source project
        const sourceProject = await Project.findOne({ id: sourceProjectId, userId: req.userId });
        if (!sourceProject) return res.status(404).json({ error: "Source project not found" });
        
        const chatToMove = sourceProject.chats.find(chat => chat.threadId === threadId);
        if (!chatToMove) return res.status(404).json({ error: "Chat not found in source project" });
        
        // Check if target project exists
        const targetProject = await Project.findOne({ id: targetProjectId, userId: req.userId });
        if (!targetProject) return res.status(404).json({ error: "Target project not found" });
        
        // Check if chat already exists in target project
        const chatExists = targetProject.chats.some(chat => chat.threadId === threadId);
        
        if (chatExists) {
            return res.status(400).json({ error: "Chat already exists in target project" });
        }
        
        // Add chat to target project
        const updatedTarget = await Project.findOneAndUpdate(
            { id: targetProjectId, userId: req.userId },
            { 
                $push: { 
                    chats: { 
                        ...chatToMove.toObject(),
                        projectId: targetProjectId,
                        isShared: makeCopy ? false : chatToMove.isShared,
                        lastModified: new Date()
                    } 
                },
                $set: { updatedAt: new Date() }
            },
            { new: true }
        );
        
        // If not making a copy, remove from source project
        if (!makeCopy) {
            await Project.findOneAndUpdate(
                { id: sourceProjectId, userId: req.userId },
                { 
                    $pull: { chats: { threadId } },
                    $set: { updatedAt: new Date() }
                }
            );
        }
        
        // Update thread's project references
        await Thread.findOneAndUpdate(
            { threadId, userId: req.userId },
            { 
                $addToSet: { projectIds: targetProjectId },
                $pull: makeCopy ? {} : { projectIds: sourceProjectId }
            },
            { upsert: true }
        );
        
        res.json({
            success: true,
            message: makeCopy ? "Chat copied successfully" : "Chat moved successfully",
            project: updatedTarget
        });
        
    } catch (err) {
        console.error("Error moving/copying chat:", err);
        res.status(500).json({ error: "Failed to move/copy chat" });
    }
});

// Remove chat from all projects
router.delete("/projects/all/chats/:threadId", async (req, res) => {
    const { threadId } = req.params;
    
    try {
        // Remove chat from all projects
        await Project.updateMany(
            { userId: req.userId },
            { 
                $pull: { chats: { threadId } },
                $set: { updatedAt: new Date() }
            }
        );
        
        res.status(200).json({ success: "Chat removed from all projects" });
    } catch (err) {
        console.error("Error removing chat from all projects:", err);
        res.status(500).json({ error: "Failed to remove chat from projects" });
    }
});

// Remove chat from project
router.delete("/projects/:id/chats/:threadId", async (req, res) => {
    const { id, threadId } = req.params;
    const { removeFromAll = false } = req.query;
    
    try {
        // Verify the thread exists before removing
        const thread = await Thread.findOne({ threadId, userId: req.userId });
        if (!thread) {
            return res.status(404).json({ error: "Thread not found" });
        }
        
        if (removeFromAll === 'true') {
            // Remove chat from all projects
            await Project.updateMany(
                { userId: req.userId },
                { 
                    $pull: { chats: { threadId } },
                    $set: { updatedAt: new Date() }
                }
            );
            
            // Remove project references from thread
            await Thread.findOneAndUpdate(
                { threadId, userId: req.userId },
                { $set: { projectIds: [] } }
            );
        } else {
            // Remove chat from specific project only
            await Project.findOneAndUpdate(
                { id: id, userId: req.userId },
                { 
                    $pull: { chats: { threadId } },
                    $set: { updatedAt: new Date() }
                }
            );
            
            // Remove project reference from thread
            await Thread.findOneAndUpdate(
                { threadId, userId: req.userId },
                { $pull: { projectIds: id } }
            );
        }
        
        res.json({ success: true });
    } catch (err) {
        console.error("Error removing chat from project:", err);
        res.status(500).json({ error: "Failed to remove chat from project" });
    }
});

// Update chat details in project
router.put("/projects/:id/chats/:threadId", async (req, res) => {
    const { id, threadId } = req.params;
    const { title, isShared } = req.body;
    
    if (!title && isShared === undefined) {
        return res.status(400).json({ error: "No valid fields to update" });
    }
    
    try {
        const update = { "chats.$.lastModified": new Date() };
        if (title) update["chats.$.title"] = title;
        if (isShared !== undefined) update["chats.$.isShared"] = isShared;
        
        const updated = await Project.findOneAndUpdate(
            { id: id, userId: req.userId, "chats.threadId": threadId },
            { $set: update },
            { new: true }
        );
        
        if (!updated) {
            return res.status(404).json({ error: "Project or chat not found" });
        }
        
        res.json(updated);
    } catch (err) {
        console.error("Error updating chat in project:", err);
        res.status(500).json({ error: "Failed to update chat in project" });
    }
});

// Search chats across projects
router.get("/projects/chats/search", async (req, res) => {
    try {
        const { query, projectId } = req.query;
        
        if (!query) {
            return res.status(400).json({ error: "Search query is required" });
        }
        
        const searchQuery = projectId 
            ? { id: projectId, userId: req.userId, isActive: true }
            : { userId: req.userId, isActive: true };
        
        // First, find projects with matching names or chat titles
        const projects = await Project.find({
            ...searchQuery,
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { 'chats.title': { $regex: query, $options: 'i' } }
            ]
        });
        
        // Then, search for threads with matching content
        const threads = await Thread.find({
            $text: { $search: query }
        });
        
        const threadIds = threads.map(thread => thread.threadId);
        
        const results = [];
        
        // Add results from project search
        projects.forEach(project => {
            project.chats.forEach(chat => {
                if (chat.title.toLowerCase().includes(query.toLowerCase()) || 
                    threadIds.includes(chat.threadId)) {
                    // Check if this result is already in the array
                    if (!results.some(r => r.threadId === chat.threadId)) {
                        results.push({
                            projectId: project.id,
                            projectName: project.name,
                            threadId: chat.threadId,
                            title: chat.title,
                            isShared: chat.isShared,
                            lastModified: chat.lastModified
                        });
                    }
                }
            });
        });
        
        // Sort by last modified date (newest first)
        results.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
        
        res.json(results);
    } catch (err) {
        console.error("Error searching chats:", err);
        res.status(500).json({ error: "Failed to search chats" });
    }
});

export default router;


