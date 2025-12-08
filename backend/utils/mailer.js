import { Resend } from 'resend';

// Initialize Resend with API key from environment variables
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DEFAULT_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'SvaraGPT <onboarding@resend.dev>';

let resend = null;

// Check if API key is configured
if (!RESEND_API_KEY) {
    console.warn('⚠️  WARNING: RESEND_API_KEY is not set in environment variables!');
    console.warn('📧 Email functionality disabled - Using Google OAuth only (no email verification needed)');
} else {
    resend = new Resend(RESEND_API_KEY);
    console.log('✅ Resend API key is configured');
    console.log('📧 Default sender email:', DEFAULT_FROM_EMAIL);
}

export async function sendVerificationEmail(email, name, code) {
    if (!resend) {
        console.warn('⚠️  Email sending skipped: Resend not configured (Google OAuth only mode)');
        return true; // Return true to not break the flow
    }

    const mailOptions = {
        from: DEFAULT_FROM_EMAIL,
        to: email,
        subject: "Verify Your Email - SvaraGPT",
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .code { font-size: 32px; font-weight: bold; color: #667eea; text-align: center; letter-spacing: 8px; margin: 20px 0; padding: 15px; background: white; border-radius: 8px; border: 2px dashed #667eea; }
                    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Welcome to SvaraGPT!</h1>
                    </div>
                    <div class="content">
                        <p>Hi ${name},</p>
                        <p>Thank you for registering with SvaraGPT. To complete your registration, please verify your email address using the code below:</p>
                        <div class="code">${code}</div>
                        <p>This code will expire in <strong>15 minutes</strong>.</p>
                        <p>If you didn't create an account with SvaraGPT, please ignore this email.</p>
                        <div class="footer">
                            <p>&copy; ${new Date().getFullYear()} SvaraGPT. All rights reserved.</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `,
    };

    try {
        const { data, error } = await resend.emails.send(mailOptions);
        
        if (error) {
            console.error("Error sending verification email:", error);
            return false;
        }
        
        console.log("Verification email sent successfully:", data);
        return true;
    } catch (error) {
        console.error("Error sending verification email:", error);
        return false;
    }
}

export async function sendContactEmail(name, email, category, message) {
    console.log('📧 Attempting to send contact email...');
    console.log('From:', email, '| Name:', name, '| Category:', category);
    
    if (!resend) {
        console.error('❌ Cannot send email: RESEND_API_KEY is not configured');
        return false;
    }
    
    const recipientEmail = process.env.RESEND_RECIPIENT_EMAIL || process.env.EMAIL_USER || "gjain0229@gmail.com";
    console.log('Recipient:', recipientEmail);
    
    const mailOptions = {
        from: DEFAULT_FROM_EMAIL,
        to: recipientEmail,
        replyTo: email,
        subject: `[SvaraGPT Contact] ${category} - ${name}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f4f4f4; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .header { background: linear-gradient(135deg, #da7756 0%, #e89b7e 100%); color: white; padding: 30px; text-align: center; }
                    .header h1 { margin: 0; font-size: 24px; }
                    .content { padding: 30px; }
                    .info-row { margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee; }
                    .info-label { font-weight: bold; color: #da7756; margin-bottom: 5px; }
                    .info-value { color: #333; }
                    .category-badge { display: inline-block; padding: 5px 15px; background: #da7756; color: white; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
                    .message-box { background: #f9f9f9; padding: 20px; border-radius: 8px; border-left: 4px solid #da7756; margin-top: 20px; }
                    .footer { text-align: center; padding: 20px; background: #f9f9f9; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>📧 New Contact Form Submission</h1>
                    </div>
                    <div class="content">
                        <div class="info-row">
                            <div class="info-label">From:</div>
                            <div class="info-value">${name}</div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">Email:</div>
                            <div class="info-value"><a href="mailto:${email}" style="color: #da7756; text-decoration: none;">${email}</a></div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">Category:</div>
                            <div class="info-value"><span class="category-badge">${category}</span></div>
                        </div>
                        <div class="info-row" style="border-bottom: none;">
                            <div class="info-label">Message:</div>
                            <div class="message-box">${message.replace(/\n/g, '<br>')}</div>
                        </div>
                    </div>
                    <div class="footer">
                        <p>This email was sent from the SvaraGPT contact form</p>
                        <p>&copy; ${new Date().getFullYear()} SvaraGPT. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
    };

    try {
        const { data, error } = await resend.emails.send(mailOptions);
        
        if (error) {
            console.error("❌ Resend API Error:", error);
            console.error("Error details:", JSON.stringify(error, null, 2));
            return false;
        }
        
        console.log("✅ Contact email sent successfully!");
        console.log("Email ID:", data?.id);
        return true;
    } catch (error) {
        console.error("❌ Exception sending contact email:", error);
        console.error("Error message:", error.message);
        console.error("Stack trace:", error.stack);
        return false;
    }
}

export async function sendPasswordResetEmail(email, name, code) {
    if (!resend) {
        console.warn('⚠️  Email sending skipped: Resend not configured (Google OAuth only mode)');
        return true; // Return true to not break the flow
    }

    const mailOptions = {
        from: DEFAULT_FROM_EMAIL,
        to: email,
        subject: "Reset Your Password - SvaraGPT",
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .code { font-size: 32px; font-weight: bold; color: #667eea; text-align: center; letter-spacing: 8px; margin: 20px 0; padding: 15px; background: white; border-radius: 8px; border: 2px dashed #667eea; }
                    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
                    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔒 Password Reset Request</h1>
                    </div>
                    <div class="content">
                        <p>Hi ${name},</p>
                        <p>We received a request to reset your password for your SvaraGPT account. Use the verification code below to reset your password:</p>
                        <div class="code">${code}</div>
                        <p>This code will expire in <strong>15 minutes</strong>.</p>
                        <div class="warning">
                            <strong>⚠️ Security Notice:</strong> If you didn't request this password reset, please ignore this email and your password will remain unchanged.
                        </div>
                        <div class="footer">
                            <p>&copy; ${new Date().getFullYear()} SvaraGPT. All rights reserved.</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `,
    };

    try {
        const { data, error } = await resend.emails.send(mailOptions);
        
        if (error) {
            console.error("Error sending password reset email:", error);
            return false;
        }
        
        console.log("Password reset email sent successfully:", data);
        return true;
    } catch (error) {
        console.error("Error sending password reset email:", error);
        return false;
    }
}
