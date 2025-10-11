import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER || "gjain0229@gmail.com",
        pass: process.env.EMAIL_PASS,
    },
});

export async function sendVerificationEmail(email, name, code) {
    const mailOptions = {
        from: `"SvaraGPT" <${process.env.EMAIL_USER || "gjain0229@gmail.com"}>`,
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