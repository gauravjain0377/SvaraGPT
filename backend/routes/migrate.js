import express from "express";
import Thread from "../models/Thread.js";
import Project from "../models/Project.js";
import { authGuard } from "../middleware/authGuard.js";

const router = express.Router();

/**
 * POST /api/migrate/guest-data
 * Migrates all guest user data to authenticated user account
 * Gets guest ID from cookie automatically
 */
router.post("/guest-data", authGuard, async (req, res) => {
    try {
        const authenticatedUserId = req.userId;
        const guestId = req.cookies.svara_guest_id;

        if (!guestId || !guestId.startsWith('guest_')) {
            return res.json({
                success: true,
                migrated: { threads: 0, projects: 0 },
                message: "No guest data to migrate"
            });
        }

        console.log(`🔄 [MIGRATION] Starting migration from ${guestId} to ${authenticatedUserId}`);

        // Update all threads
        const threadsResult = await Thread.updateMany(
            { userId: guestId },
            { $set: { userId: authenticatedUserId } }
        );

        // Update all projects (guests shouldn't have projects, but just in case)
        const projectsResult = await Project.updateMany(
            { userId: guestId },
            { $set: { userId: authenticatedUserId } }
        );

        // Clear the guest cookie after migration
        res.clearCookie('svara_guest_id');

        console.log(`✅ [MIGRATION] Migrated ${threadsResult.modifiedCount} threads and ${projectsResult.modifiedCount} projects`);

        res.json({
            success: true,
            migrated: {
                threads: threadsResult.modifiedCount,
                projects: projectsResult.modifiedCount
            }
        });
    } catch (error) {
        console.error("❌ [MIGRATION] Error:", error);
        res.status(500).json({ error: "Failed to migrate guest data" });
    }
});

export default router;