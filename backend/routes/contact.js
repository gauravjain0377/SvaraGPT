import express from "express";
import { sendContactEmail } from "../utils/mailer.js";

const router = express.Router();

// Contact form submission
router.post("/contact", async (req, res) => {
    try {
        const { name, email, category, message } = req.body;

        // Validation
        if (!name || !email || !category || !message) {
            return res.status(400).json({ 
                error: "All fields are required" 
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                error: "Invalid email address" 
            });
        }

        // Send email
        const emailSent = await sendContactEmail(name, email, category, message);

        if (emailSent) {
            res.json({ 
                success: true, 
                message: "Your message has been sent successfully! We'll get back to you soon." 
            });
        } else {
            res.status(500).json({ 
                error: "Failed to send message. Please try again later." 
            });
        }
    } catch (error) {
        console.error("Contact form error:", error);
        res.status(500).json({ 
            error: "An error occurred while sending your message" 
        });
    }
});

export default router;