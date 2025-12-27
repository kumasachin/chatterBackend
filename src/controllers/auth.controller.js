import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";
import { validateUserName } from "../utils/messageCensorship.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import {
  sendVerificationEmail,
  sendResetVerificationEmail,
  sendWelcomeEmail,
} from "../lib/emailService.js";
import { autoAddAIBotFriend, sendWelcomeMessage } from "./ai.controller.js";

// signup handler - handles both required and optional fields
export const signup = async (req, res) => {
  const {
    name,
    password,
    profile,
    fullName,
    email,
    gender,
    dateOfBirth,
    captchaCompleted,
  } = req.body;
  try {
    // basic validation first
    if (!name || !password || !fullName || !email) {
      return res
        .status(400)
        .json({ message: "Name, password, full name, and email are required" });
    }

    // Check if captcha was completed (frontend validation)
    if (!captchaCompleted) {
      return res
        .status(400)
        .json({ message: "Please complete the captcha verification" });
    }

    // Enhanced name validation using third-party libraries
    const nameValidation = validateUserName(name);
    if (!nameValidation.isValid) {
      return res.status(400).json({
        message: nameValidation.message,
        details: nameValidation.suggestions
          ? nameValidation.suggestions.join(". ")
          : "Please choose a different name",
        violations: nameValidation.violations,
      });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    // check if username already taken
    const existingUser = await User.findOne({ name });
    if (existingUser) {
      return res.status(400).json({ message: "name already exists" });
    }

    // check if email already taken
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: "email already exists" });
    }

    // Enhanced fullName validation - now required
    const fullNameValidation = validateUserName(fullName);
    if (!fullNameValidation.isValid) {
      return res.status(400).json({
        message: "Full name contains inappropriate language",
        details: fullNameValidation.suggestions
          ? fullNameValidation.suggestions.join(". ")
          : "Please choose a different full name",
        violations: fullNameValidation.violations,
      });
    }

    // hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // create new user with optional fields
    const newUser = new User({
      name,
      password: hashedPassword,
      profile,
      fullName,
      email,
      isEmailVerified: false,
      gender: gender || null,
      dateOfBirth: dateOfBirth || null,
    });

    if (newUser) {
      await newUser.save();

      // Send verification email
      try {
        await sendVerificationEmail(newUser);
      } catch (emailError) {
        console.error("Email verification failed:", emailError);
        // Don't fail the registration if email fails
      }

      generateToken(newUser._id, res);

      // return user data (excluding password)
      res.status(201).json({
        _id: newUser._id,
        name: newUser.name,
        fullName: newUser.fullName,
        email: newUser.email,
        gender: newUser.gender,
        dateOfBirth: newUser.dateOfBirth,
        profile: newUser.profile,
        message:
          "Registration successful. Please check your email to verify your account.",
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};
export const login = async (req, res) => {
  const { name, password } = req.body;
  try {
    const user = await User.findOne({ name });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check if this is the first login (welcome email not sent yet)
    const isFirstLogin = !user.lastWelcomeEmailSent;

    // Send welcome email for first-time login
    if (isFirstLogin && user.email && !user.isGuest) {
      try {
        await sendWelcomeEmail(user);
        // Update user to mark welcome email as sent
        await User.findByIdAndUpdate(user._id, {
          lastWelcomeEmailSent: new Date(),
          lastLogin: new Date(),
        });

        // Send ChatterBot welcome message
        setTimeout(() => {
          sendWelcomeMessage(user._id);
        }, 2000); // Delay to ensure user is connected
      } catch (emailError) {
        console.error("Welcome email failed:", emailError);
        // Don't fail login if email fails
      }
    } else {
      // Update last login time for returning users
      await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });
    }

    const token = generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      name: user.name,
      profile: user.profile,
      token,
      isFirstLogin,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Guest login handler - creates a temporary guest user
export const guestLogin = async (req, res) => {
  try {
    // Check if database is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: "Service temporarily unavailable. Database connection error.",
      });
    }

    // Generate a unique guest username with timestamp
    const guestNumber = Date.now().toString().slice(-6);
    const guestUsername = `Guest_${guestNumber}`;

    // Create a temporary guest user (no password, email, etc.)
    const guestUser = new User({
      name: guestUsername,
      fullName: `Guest User ${guestNumber}`,
      email: `guest_${guestNumber}@chatter.local`,
      password: await bcrypt.hash("guest123", 10), // Simple password for guests
      profile: "/avatar-demo.html", // Default guest avatar
      isGuest: true, // Mark as guest user
    });

    await guestUser.save();

    // Automatically add AI bot as friend for guest users
    try {
      await autoAddAIBotFriend(guestUser._id);
    } catch (error) {
      // Continue even if AI bot friend add fails
    }

    // Send welcome message from ChatterBot
    try {
      await sendWelcomeMessage(guestUser._id);
    } catch (error) {
      // Continue even if welcome message fails
    }

    const token = generateToken(guestUser._id, res);

    res.status(200).json({
      _id: guestUser._id,
      name: guestUser.name,
      profile: guestUser.profile,
      token,
      isGuest: true,
    });
  } catch (error) {
    console.error("Guest login error:", error);

    // Provide more specific error messages
    if (error.name === "MongooseError" || error.name === "MongoError") {
      return res.status(503).json({
        message: "Database connection error. Please try again later.",
      });
    }

    res.status(500).json({
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
export const logout = (req, res) => {
  try {
    res.clearCookie("jwt", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};
export const updateProfile = async (req, res) => {
  try {
    const { profile } = req.body;
    const userId = req.user._id;

    if (!profile) {
      return res.status(400).json({ message: "Profile pic is required" });
    }

    const uploadResponse = await cloudinary.uploader.upload(profile);
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profile: uploadResponse.secure_url },
      { new: true }
    );

    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res
        .status(400)
        .json({ message: "Verification token is required" });
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({
      _id: decodedToken.userId,
      isEmailVerified: false,
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid verification token or email already verified",
      });
    }

    user.isEmailVerified = true;
    await user.save();

    return res.status(200).json({ message: "Email verified successfully!" });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(400).json({ message: "Verification link has expired" });
    }
    return res.status(500).json({ message: "Failed to verify email" });
  }
};

export const checkAuth = (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};
export const updateUserInfo = async (req, res) => {
  try {
    const { fullName, email, gender, dateOfBirth } = req.body;
    const userId = req.user._id;

    // Enhanced fullName validation if provided
    if (fullName) {
      const fullNameValidation = validateUserName(fullName);
      if (!fullNameValidation.isValid) {
        return res.status(400).json({
          message: "Full name contains inappropriate language",
          details: fullNameValidation.suggestions
            ? fullNameValidation.suggestions.join(". ")
            : "Please choose a different full name",
          violations: fullNameValidation.violations,
        });
      }
    }

    // Create update object with only provided fields
    const updateData = {};

    if (fullName !== undefined) updateData.fullName = fullName;
    if (email !== undefined) updateData.email = email;
    if (gender !== undefined) updateData.gender = gender;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    }).select("-password");

    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ message: "No user found with this email address" });
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Save reset token to user (optional - for additional security)
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

    // You can implement actual email sending here using your email service
    // await sendPasswordResetEmail(user.email, resetUrl);
    await user.save();

    try {
      await sendResetVerificationEmail(user);
    } catch (emailError) {
      console.error("Password reset failed:", emailError);
      // Don't fail the registration if email fails
    }

    res.status(200).json({
      message: "Password reset link has been sent to your email address",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const resetPassword = async (req, res) => {
  const { token, password } = req.body;

  try {
    if (!token || !password) {
      return res
        .status(400)
        .json({ message: "Token and password are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long" });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset token" });
    }

    // Find user
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if token matches and hasn't expired (if using database storage)
    if (
      user.resetPasswordToken !== token ||
      user.resetPasswordExpires < Date.now()
    ) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset token" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update password and clear reset token
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Password has been reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const resendVerificationEmail = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user is already verified
    if (user.isEmailVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    // Send verification email
    const emailSent = await sendVerificationEmail(user);
    if (!emailSent) {
      return res.status(500).json({
        message: "Failed to send verification email. Please try again later.",
      });
    }

    res.status(200).json({
      message: "Verification email has been sent successfully",
    });
  } catch (error) {
    console.error("Resend verification email error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const generateCaptcha = (req, res) => {
  try {
    // Generate simple text CAPTCHA
    const characters =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let captchaText = "";
    for (let i = 0; i < 5; i++) {
      captchaText += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }

    // Generate session ID
    const sessionId =
      Date.now().toString() + Math.random().toString(36).substr(2, 9);

    // Store CAPTCHA in global memory (in production, use Redis or database)
    global.captchaStore = global.captchaStore || new Map();
    global.captchaStore.set(sessionId, {
      text: captchaText,
      expires: Date.now() + 300000, // 5 minutes
    });

    // Clean up expired CAPTCHAs
    for (const [key, value] of global.captchaStore.entries()) {
      if (value.expires < Date.now()) {
        global.captchaStore.delete(key);
      }
    }

    // For now, return a simple SVG-based CAPTCHA
    const svgCaptcha = `
      <svg width="200" height="60" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="60" fill="#f0f0f0"/>
        <text x="20" y="40" font-family="Arial" font-size="24" fill="#333">${captchaText}</text>
      </svg>
    `;

    const base64Image = `data:image/svg+xml;base64,${Buffer.from(
      svgCaptcha
    ).toString("base64")}`;

    res.status(200).json({
      sessionId,
      captchaImage: base64Image,
    });
  } catch (error) {
    console.error("CAPTCHA generation error:", error);
    res.status(500).json({ message: "Failed to generate CAPTCHA" });
  }
};
