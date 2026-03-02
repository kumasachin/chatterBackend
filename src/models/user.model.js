import mongoose from "mongoose";

// user schema with required and optional fields
const userSchema = new mongoose.Schema(
  {
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    name: {
      type: String,
      required: true,
      unique: true, // enforce uniqueness at DB level (eliminates TOCTOU race)
    },
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: function (v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: "Please enter a valid email address",
      },
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: null,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    profile: {
      type: String,
      default: null, // avatar URL from cloudinary
    },
    isGuest: {
      type: Boolean,
      default: false, // indicates if this is a guest user
    },
    isAIBot: {
      type: Boolean,
      default: false, // indicates if this is an AI bot user
    },
    lastWelcomeEmailSent: {
      type: Date,
      default: null, // tracks when welcome email was sent
    },
    lastLogin: {
      type: Date,
      default: null, // tracks last login time
    },
    // array of user IDs who are friends
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Password reset fields
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }, // adds createdAt and updatedAt automatically
);

// ── Indexes ────────────────────────────────────────────────────────────────
// Full-text search across username and display name
userSchema.index({ name: "text", fullName: "text" });
// Note: { name: 1 } index is already created by unique:true on the name field
// Sort by newest users in admin views
userSchema.index({ createdAt: -1 });
// Look up guest users for cleanup jobs
userSchema.index({ isGuest: 1, createdAt: 1 });

const User = mongoose.model("User", userSchema);

export default User;
