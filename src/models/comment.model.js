import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 1000,
      trim: true,
    },
    likes: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    likeCount: { type: Number, default: 0, min: 0 },
    // Null = top-level comment, set = reply to another comment
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
  },
  { timestamps: true },
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// All comments for a post, newest first
commentSchema.index({ post: 1, createdAt: -1 });
// Replies to a comment
commentSchema.index({ parentComment: 1, createdAt: 1 });

const Comment = mongoose.model("Comment", commentSchema);
export default Comment;
