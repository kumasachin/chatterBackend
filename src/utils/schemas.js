import { z } from "zod";

/**
 * Zod schemas for request body validation.
 * Import the relevant schema and pass it to validateBody() in each route.
 */

export const signupSchema = z.object({
  name: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores",
    ),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password is too long"),
  fullName: z
    .string()
    .min(1, "Full name is required")
    .max(100, "Full name is too long"),
  email: z.string().email("Please provide a valid email address"),
  captchaCompleted: z
    .boolean()
    .refine((v) => v === true, "Captcha verification is required"),
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  profile: z.string().optional().nullable(),
});

export const loginSchema = z.object({
  name: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please provide a valid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password is too long"),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});

export const resendVerificationSchema = z.object({
  email: z.string().email("Please provide a valid email address"),
});

export const updateUserInfoSchema = z.object({
  fullName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  gender: z.enum(["male", "female", "other"]).optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
});

export const sendMessageSchema = z.object({
  content: z.string().max(5000, "Message is too long").optional(),
  image: z.string().optional(),
}).refine(
  (data) => data.content || data.image,
  "Message must have content or an image",
);
