import nodemailer from "nodemailer";
import "dotenv/config";

// Create reusable transporter
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
        user: process.env.MAIL_USER || process.env.EMAIL_USER,
        pass: process.env.MAIL_PASS || process.env.EMAIL_PASS
    }
    });
};

// HTML email template for verification
const getVerificationEmailTemplate = (code, name) => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                margin: 0;
                padding: 0;
                background-color: #f9f9f9;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #ffffff;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            }
            .header {
                text-align: center;
                padding: 20px 0;
                border-bottom: 1px solid #eee;
            }
            .logo {
                font-size: 24px;
                font-weight: bold;
                color: #5c6bc0;
            }
            .content {
                padding: 30px 20px;
                text-align: center;
            }
            .verification-code {
                font-size: 32px;
                font-weight: bold;
                letter-spacing: 5px;
                color: #5c6bc0;
                margin: 20px 0;
                padding: 10px;
                background-color: #f0f2ff;
                border-radius: 4px;
                display: inline-block;
            }
            .button {
                display: inline-block;
                padding: 12px 24px;
                background-color: #5c6bc0;
                color: white;
                text-decoration: none;
                border-radius: 4px;
                font-weight: bold;
                margin: 20px 0;
            }
            .footer {
                text-align: center;
                padding: 20px;
                color: #888;
                font-size: 12px;
                border-top: 1px solid #eee;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">SvaraGPT</div>
            </div>
            <div class="content">
                <h2>Verify Your Email Address</h2>
                <p>Hello ${name || 'there'},</p>
                <p>Thank you for registering with SvaraGPT. To complete your registration, please use the verification code below:</p>
                <div class="verification-code">${code}</div>
                <p>This code will expire in 1 hour.</p>
                <p>If you didn't request this verification, you can safely ignore this email.</p>
            </div>
            <div class="footer">
                <p>&copy; ${new Date().getFullYear()} SvaraGPT. All rights reserved.</p>
                <p>If you need any assistance, please contact our support team.</p>
            </div>
        </div>
    </body>
    </html>
    `;
};

// Send verification email
export const sendVerificationEmail = async (email, code, name) => {
    try {
        const transporter = createTransporter();
        
        const mailOptions = {
            from: `"SvaraGPT" <${process.env.MAIL_USER || process.env.EMAIL_USER}>`,
            to: email,
            subject: "Verify Your Email Address",
            html: getVerificationEmailTemplate(code, name)
        };
        
        const info = await transporter.sendMail(mailOptions);
        console.log("Verification email sent:", info.messageId);
        return info;
    } catch (error) {
        console.error("Error sending verification email:", error);
        throw error;
    }
};