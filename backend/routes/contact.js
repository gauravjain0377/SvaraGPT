import express from "express";
import { sendContactEmail } from "../utils/mailer.js";

const router = express.Router();

// Contact form submission
router.post("/contact", async (req, res) => {
    try {
        console.log('📬 Contact form submission received');
        const { name, email, category, message } = req.body;

        // Validation
        if (!name || !email || !category || !message) {
            console.log('❌ Validation failed: Missing fields');
            return res.status(400).json({ 
                error: "All fields are required" 
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            console.log('❌ Validation failed: Invalid email format');
            return res.status(400).json({ 
                error: "Invalid email address" 
            });
        }

        console.log('✅ Validation passed, sending email...');
        
        // Check if Resend is configured
        if (!process.env.RESEND_API_KEY) {
            console.error('❌ RESEND_API_KEY not configured');
            return res.status(500).json({ 
                error: "Email service is not configured. Please contact the administrator." 
            });
        }

        // Send email
        const emailSent = await sendContactEmail(name, email, category, message);

        if (emailSent) {
            console.log('✅ Email sent successfully');
            res.json({ 
                success: true, 
                message: "Your message has been sent successfully! We'll get back to you soon." 
            });
        } else {
            console.error('❌ Email sending failed');
            res.status(500).json({ 
                error: "Failed to send message. Please check your email configuration and try again." 
            });
        }
    } catch (error) {
        console.error("❌ Contact form error:", error);
        console.error("Error stack:", error.stack);
        res.status(500).json({ 
            error: "An error occurred while sending your message. Please try again later.",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

export default router;