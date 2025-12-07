import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT) || 465,
    secure: process.env.EMAIL_SECURE === 'true' || true,
    auth: {
        user: process.env.EMAIL_USER || process.env.MAIL_USER || "gjain0229@gmail.com",
        pass: process.env.EMAIL_PASS || process.env.MAIL_PASS,
    },
});

export async function sendVerificationEmail(email, name, code) {
    const senderEmail = process.env.EMAIL_USER || process.env.MAIL_USER || "gjain0229@gmail.com";
    const mailOptions = {
        from: `"SvaraGPT" <${senderEmail}>`,
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
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error("Error sending verification email:", error);
        return false;
    }
}

export async function sendContactEmail(name, email, category, message) {
    const senderEmail = process.env.EMAIL_USER || process.env.MAIL_USER || "gjain0229@gmail.com";
    const mailOptions = {
        from: `"SvaraGPT Contact Form" <${senderEmail}>`,
        to: senderEmail,
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
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error("Error sending contact email:", error);
        return false;
    }
}

export async function sendPasswordResetEmail(email, name, code) {
    const senderEmail = process.env.EMAIL_USER || process.env.MAIL_USER || "gjain0229@gmail.com";
    const mailOptions = {
        from: `"SvaraGPT" <${senderEmail}>`,
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
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error("Error sending password reset email:", error);
        return false;
    }
}