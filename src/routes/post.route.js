import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { createPostSchema, addCommentSchema } from "../utils/schemas.js";
import {
  createPost,
  getFeed,
  getPost,
  deletePost,
  toggleLike,
  addComment,
  getComments,
} from "../controllers/post.controller.js";

const router = express.Router();

// All post routes require authentication
router.use(protectRoute);

router.get("/feed", getFeed);
router.post("/", validateBody(createPostSchema), createPost);
router.get("/:id", getPost);
router.delete("/:id", deletePost);
router.post("/:id/like", toggleLike);
router.get("/:id/comments", getComments);
router.post("/:id/comments", validateBody(addCommentSchema), addComment);

export default router;
