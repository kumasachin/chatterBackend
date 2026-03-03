import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { logger } from "../lib/logger.js";

export const protectRoute = async (req, res, next) => {
  try {
    // Check Authorization header first (Bearer <token>), fall back to cookie
    const token = req.headers.authorization?.split(" ")[1] || req.cookies.jwt;

    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized - No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return res.status(401).json({ message: "Unauthorized - User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    // JWT-specific errors → 401 (client's problem, not a server fault)
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError" ||
      error.name === "NotBeforeError"
    ) {
      return res.status(401).json({
        message:
          error.name === "TokenExpiredError"
            ? "Session expired - please log in again"
            : "Unauthorized - Invalid token",
      });
    }

    // Genuine infrastructure error
    logger.error({ err: error }, "protectRoute: unexpected error");
    res.status(500).json({ message: "Internal server error" });
  }
};
