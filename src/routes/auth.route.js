import express from "express";
import {
  checkAuth,
  login,
  logout,
  signup,
  updateProfile,
  updateUserInfo,
  verifyEmail,
  forgotPassword,
  resetPassword,
  resendVerificationEmail,
  guestLogin,
} from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import {
  authLimiter,
  signupLimiter,
  passwordResetLimiter,
} from "../middleware/rateLimiter.middleware.js";
import {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  updateUserInfoSchema,
} from "../utils/schemas.js";

const router = express.Router();

// ── Public routes ─────────────────────────────────────────────────────────────
router.post("/signup", signupLimiter, validateBody(signupSchema), signup);
router.post("/login", authLimiter, validateBody(loginSchema), login);
router.post("/guest-login", authLimiter, guestLogin);
router.post("/logout", logout);
router.post("/verify-email", validateBody(verifyEmailSchema), verifyEmail);
router.post(
  "/resend-verification",
  passwordResetLimiter,
  validateBody(resendVerificationSchema),
  resendVerificationEmail,
);
router.post(
  "/forgot-password",
  passwordResetLimiter,
  validateBody(forgotPasswordSchema),
  forgotPassword,
);
router.post(
  "/reset-password",
  validateBody(resetPasswordSchema),
  resetPassword,
);

// ── Protected routes ──────────────────────────────────────────────────────────
router.put("/update-profile", protectRoute, updateProfile);
router.put(
  "/update-info",
  protectRoute,
  validateBody(updateUserInfoSchema),
  updateUserInfo,
);
router.get("/check", protectRoute, checkAuth);

export default router;
