import cloudinary from "../lib/cloudinary.js";
import Post from "../models/post.model.js";
import Comment from "../models/comment.model.js";
import User from "../models/user.model.js";
import { io } from "../lib/socket.js";
import { logger } from "../lib/logger.js";
import { AppError } from "../utils/appError.js";
import { cacheGet, cacheSet, cacheDel } from "../lib/redis.js";

// ── Helpers ───────────────────────────────────────────────────────────────────
const FEED_CACHE_TTL = 30; // seconds

function feedCacheKey (userId, page) {
  return `feed:${userId}:${page}`;
}

async function uploadImages (images = []) {
  return Promise.all(
    images.map(img =>
      cloudinary.uploader.upload(img, { folder: "chatter/posts" }),
    ),
  );
}

// ── Create post ───────────────────────────────────────────────────────────────
export const createPost = async (req, res, next) => {
  try {
    const { content, images = [], visibility = "friends" } = req.body;

    if (!content?.trim() && images.length === 0) {
      throw new AppError("Post must have content or at least one image", 400);
    }

    let imageUrls = [];
    if (images.length) {
      const uploads = await uploadImages(images);
      imageUrls = uploads.map(u => u.secure_url);
    }

    const post = await Post.create({
      author: req.user._id,
      content: content?.trim() || "",
      images: imageUrls,
      visibility,
    });

    // Populate author for the response
    await post.populate("author", "name fullName profile");

    // Invalidate sender's feed cache (page 1 at minimum)
    await cacheDel(feedCacheKey(req.user._id.toString(), 1));

    // Real-time: notify online friends about the new post
    const author = await User.findById(req.user._id).select("friends").lean();
    if (author?.friends?.length) {
      for (const friendId of author.friends) {
        io.to(`user:${friendId}`).emit("newPost", {
          post,
          authorId: req.user._id,
        });
      }
    }

    logger.info({ postId: post._id, userId: req.user._id }, "Post created");
    res.status(201).json(post);
  } catch (err) {
    next(err);
  }
};

// ── Get feed (friends + own posts) ───────────────────────────────────────────
export const getFeed = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(20, parseInt(req.query.limit) || 10);
    const userId = req.user._id.toString();

    // Try cache on page 1 only (subsequent pages change too fast to cache well)
    if (page === 1) {
      const cached = await cacheGet(feedCacheKey(userId, 1));
      if (cached) return res.json(cached);
    }

    const me = await User.findById(userId).select("friends").lean();
    const authorIds = [req.user._id, ...(me?.friends || [])];

    const [posts, total] = await Promise.all([
      Post.find({ author: { $in: authorIds } })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("author", "name fullName profile")
        .lean(),
      Post.countDocuments({ author: { $in: authorIds } }),
    ]);

    const result = {
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    };

    if (page === 1) { await cacheSet(feedCacheKey(userId, 1), result, FEED_CACHE_TTL); }

    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ── Get single post ───────────────────────────────────────────────────────────
export const getPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("author", "name fullName profile")
      .lean();
    if (!post) throw new AppError("Post not found", 404);
    res.json(post);
  } catch (err) {
    next(err);
  }
};

// ── Delete post ───────────────────────────────────────────────────────────────
export const deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) throw new AppError("Post not found", 404);
    if (post.author.toString() !== req.user._id.toString()) {
      throw new AppError("Not authorised", 403);
    }

    // Delete Cloudinary images
    await Promise.allSettled(
      post.images.map(url => {
        const publicId = url.split("/").slice(-2).join("/").split(".")[0];
        return cloudinary.uploader.destroy(publicId);
      }),
    );

    await Promise.all([
      post.deleteOne(),
      Comment.deleteMany({ post: post._id }),
    ]);

    await cacheDel(feedCacheKey(req.user._id.toString(), 1));
    logger.info({ postId: post._id }, "Post deleted");
    res.json({ message: "Post deleted" });
  } catch (err) {
    next(err);
  }
};

// ── Toggle like ───────────────────────────────────────────────────────────────
export const toggleLike = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) throw new AppError("Post not found", 404);

    const userId = req.user._id;
    const idx = post.likes.findIndex(id => id.equals(userId));
    const liked = idx === -1;

    if (liked) {
      post.likes.push(userId);
      post.likeCount += 1;
    } else {
      post.likes.splice(idx, 1);
      post.likeCount = Math.max(0, post.likeCount - 1);
    }

    await post.save();
    res.json({ liked, likeCount: post.likeCount });
  } catch (err) {
    next(err);
  }
};

// ── Add comment ───────────────────────────────────────────────────────────────
export const addComment = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) throw new AppError("Post not found", 404);

    const comment = await Comment.create({
      post: post._id,
      author: req.user._id,
      content: req.body.content,
      parentComment: req.body.parentComment || null,
    });

    // Increment counter atomically
    await Post.findByIdAndUpdate(post._id, { $inc: { commentCount: 1 } });

    await comment.populate("author", "name fullName profile");

    // Notify post author if someone else commented
    if (!post.author.equals(req.user._id)) {
      io.to(`user:${post.author}`).emit("newComment", {
        postId: post._id,
        comment,
      });
    }

    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
};

// ── Get comments ─────────────────────────────────────────────────────────────
export const getComments = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);

    const [comments, total] = await Promise.all([
      Comment.find({ post: req.params.id, parentComment: null })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("author", "name fullName profile")
        .lean(),
      Comment.countDocuments({ post: req.params.id, parentComment: null }),
    ]);

    res.json({
      comments,
      pagination: { page, limit, total, hasMore: page * limit < total },
    });
  } catch (err) {
    next(err);
  }
};
