import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    content: {
      type: String,
      maxlength: 2000,
      default: "",
    },
    images: {
      type: [String], // Cloudinary URLs
      default: [],
      validate: {
        validator: v => v.length <= 4,
        message: "Max 4 images per post",
      },
    },
    // Denormalised counters — faster reads, updated atomically
    likeCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
    // Stores userIds who liked — cap at 10k for memory; use a separate Like
    // collection once a post reaches viral scale
    likes: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    visibility: {
      type: String,
      enum: ["public", "friends"],
      default: "friends",
    },
  },
  { timestamps: true },
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Feed query: posts by a set of authors, newest first
postSchema.index({ author: 1, createdAt: -1 });
// Explore/public feed
postSchema.index({ visibility: 1, createdAt: -1 });
// Like lookup
postSchema.index({ likes: 1 });

const Post = mongoose.model("Post", postSchema);
export default Post;
