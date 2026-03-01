import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import { logger } from "./logger.js";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendVerificationEmail = async (user) => {
  try {
    logger.debug({ userId: user._id, email: user.email }, "sendVerificationEmail called");

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      logger.error("Email configuration missing — SMTP_HOST/USER/PASS not set");
      return false;
    }

    if (!user.email) {
      logger.error({ userId: user._id }, "sendVerificationEmail: user has no email");
      return false;
    }

    // Generate verification token
    const verificationToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: user.email,
      subject: "Verify your email address",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to Chatter!</h2>
          <p>Thank you for signing up. Please verify your email address to complete your registration.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Verify Email
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
          <p style="color: #666; font-size: 12px;">This link will expire in 24 hours.</p>
        </div>
      `,
    };

    logger.info({ email: user.email }, "Verification email sent");
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    logger.error({ err: error.message, email: user.email }, "Verification email send failed");
    return false;
  }
};

export const sendWelcomeEmail = async (user) => {
  try {
    logger.debug({ userId: user._id, email: user.email }, "sendWelcomeEmail called");

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      logger.warn("Email configuration missing — skipping welcome email");
      return false;
    }

    if (!user.email) {
      logger.error({ userId: user._id }, "sendWelcomeEmail: user has no email");
      return false;
    }

    const helpUrl = `${process.env.FRONTEND_URL}/help`;
    const contactEmail = "sachin@chatter.dev";
    const supportUrl = `${process.env.FRONTEND_URL}/support`;

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: user.email,
      subject: "🎉 Welcome to Chatter - Your Journey Begins Here!",
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 700px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 15px; overflow: hidden;">
          
          <!-- Header Section -->
          <div style="background: white; padding: 40px 30px; text-align: center;">
            <h1 style="color: #333; margin: 0; font-size: 28px; font-weight: 700;">
              🚀 Welcome to Chatter, ${user.fullName || user.name}!
            </h1>
            <p style="color: #666; font-size: 18px; margin: 15px 0 0 0;">
              Where conversations come alive with AI-powered intelligence
            </p>
          </div>

          <!-- Main Content -->
          <div style="background: white; padding: 30px;">
            
            <!-- Welcome Message -->
            <div style="background: #f8faff; border-left: 4px solid #667eea; padding: 20px; margin-bottom: 25px; border-radius: 8px;">
              <h2 style="color: #333; margin: 0 0 10px 0; font-size: 20px;">🎯 You're all set!</h2>
              <p style="color: #555; margin: 0; line-height: 1.6;">
                Your Chatter account is ready. Connect with friends, chat with our intelligent ChatterBot, 
                and experience next-generation messaging built with cutting-edge technology.
              </p>
            </div>

            <!-- Features Section -->
            <h3 style="color: #333; margin: 25px 0 15px 0; font-size: 18px;">✨ What makes Chatter special:</h3>
            <ul style="color: #555; line-height: 1.8; padding-left: 20px;">
              <li><strong>AI-Powered ChatterBot:</strong> Chat with our Google Gemini-powered assistant</li>
              <li><strong>Smart Notifications:</strong> Context-aware alerts that respect your conversation flow</li>
              <li><strong>Real-time Messaging:</strong> Lightning-fast Socket.IO powered communications</li>
              <li><strong>Guest Access:</strong> Share the experience with friends instantly</li>
              <li><strong>Advanced Security:</strong> CAPTCHA protection and message filtering</li>
              <li><strong>Modern Design:</strong> Beautiful, responsive interface built with React & TypeScript</li>
            </ul>

            <!-- Tech Stack Showcase -->
            <div style="background: #f0f4ff; padding: 20px; border-radius: 10px; margin: 25px 0;">
              <h3 style="color: #333; margin: 0 0 15px 0; font-size: 18px;">🛠️ Built with Modern Technology:</h3>
              <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                <span style="background: #667eea; color: white; padding: 4px 12px; border-radius: 15px; font-size: 12px; font-weight: 500;">React 19</span>
                <span style="background: #3178c6; color: white; padding: 4px 12px; border-radius: 15px; font-size: 12px; font-weight: 500;">TypeScript</span>
                <span style="background: #00d8ff; color: white; padding: 4px 12px; border-radius: 15px; font-size: 12px; font-weight: 500;">Socket.IO</span>
                <span style="background: #10b981; color: white; padding: 4px 12px; border-radius: 15px; font-size: 12px; font-weight: 500;">Node.js</span>
                <span style="background: #47a248; color: white; padding: 4px 12px; border-radius: 15px; font-size: 12px; font-weight: 500;">MongoDB</span>
                <span style="background: #06b6d4; color: white; padding: 4px 12px; border-radius: 15px; font-size: 12px; font-weight: 500;">Tailwind CSS</span>
                <span style="background: #4285f4; color: white; padding: 4px 12px; border-radius: 15px; font-size: 12px; font-weight: 500;">Google Gemini</span>
              </div>
            </div>

            <!-- Action Buttons -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; 
                        text-decoration: none; border-radius: 25px; display: inline-block; margin: 0 10px; 
                        font-weight: 600; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
                🚀 Start Chatting
              </a>
              <a href="${helpUrl}" 
                 style="background: #f8faff; color: #667eea; padding: 15px 30px; 
                        text-decoration: none; border-radius: 25px; display: inline-block; margin: 0 10px; 
                        font-weight: 600; border: 2px solid #667eea;">
                📚 Help & Guide
              </a>
            </div>

            <!-- Help & Support Section -->
            <div style="background: #fef7f0; border: 1px solid #fed7aa; border-radius: 10px; padding: 20px; margin: 25px 0;">
              <h3 style="color: #ea580c; margin: 0 0 15px 0; font-size: 18px;">🆘 Need Help?</h3>
              <p style="color: #7c2d12; margin: 0 0 15px 0; line-height: 1.6;">
                Get started quickly with our comprehensive help resources:
              </p>
              <ul style="color: #7c2d12; margin: 0; padding-left: 20px;">
                <li><a href="${helpUrl}" style="color: #ea580c; text-decoration: none; font-weight: 500;">📖 User Guide & FAQ</a></li>
                <li><a href="${supportUrl}" style="color: #ea580c; text-decoration: none; font-weight: 500;">💬 Community Support</a></li>
                <li><a href="mailto:${contactEmail}" style="color: #ea580c; text-decoration: none; font-weight: 500;">📧 Direct Support: ${contactEmail}</a></li>
              </ul>
            </div>

            <!-- Developer Info -->
            <div style="background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 20px; margin: 25px 0; border-radius: 8px;">
              <h3 style="color: #0c4a6e; margin: 0 0 10px 0; font-size: 18px;">👨‍💻 About the Developer</h3>
              <p style="color: #075985; margin: 0; line-height: 1.6;">
                Chatter is crafted by <strong>Sachin Kumar</strong>, a passionate full-stack developer who believes in creating 
                meaningful digital experiences. This platform showcases modern web development practices, 
                AI integration, and user-centric design principles.
              </p>
            </div>

          </div>

          <!-- Footer -->
          <div style="background: #1f2937; color: white; text-align: center; padding: 30px;">
            <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600;">
              Ready to experience the future of messaging? 🌟
            </p>
            <p style="margin: 0; color: #9ca3af; font-size: 14px;">
              Connect • Chat • Innovate with Chatter
            </p>
            <div style="margin-top: 20px;">
              <a href="${process.env.FRONTEND_URL}" 
                 style="background: #667eea; color: white; padding: 10px 25px; 
                        text-decoration: none; border-radius: 20px; font-weight: 500;">
                Launch Chatter Now →
              </a>
            </div>
          </div>

        </div>
        
        <!-- Email Footer -->
        <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
          <p>This email was sent to ${user.email}</p>
          <p>Chatter - Next-Generation Messaging Platform</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    logger.info({ email: user.email }, "Welcome email sent");
    return true;
  } catch (error) {
    logger.error({ err: error.message, email: user.email }, "Welcome email send failed");
    return false;
  }
};

export const sendResetVerificationEmail = async (user) => {
  try {
    logger.debug({ userId: user._id, email: user.email }, "sendResetVerificationEmail called");

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      logger.error("Email configuration missing — SMTP vars not set");
      return false;
    }

    if (!user.email) {
      logger.error({ userId: user._id }, "sendResetVerificationEmail: user has no email");
      return false;
    }

    // Generate verification token
    const verificationToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const resetUrl = `${process.env.FRONTEND_URL}/#/reset-password?token=${verificationToken}`;
    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: user.email,
      subject: "reset your password",
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>We received a request to reset your password for your Chatter account.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
            style="background-color: #FB406C; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email.</p>
        <p style="color: #666; font-size: 12px;">This link will expire in 1 hour.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 12px;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${resetUrl}" style="color: #FB406C;">${resetUrl}</a>
        </p>
      </div>
      `,
    };
    logger.info({ email: user.email }, "Password reset email sent");
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    logger.error({ err: error.message, email: user.email }, "Password reset email send failed");
    return false;
  }
};
