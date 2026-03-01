import jwt from "jsonwebtoken";

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
const IS_PROD = process.env.NODE_ENV === "production";

export const generateToken = (userId, res) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined");
  }

  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.cookie("jwt", token, {
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,                              // not accessible via JS
    sameSite: IS_PROD ? "none" : "strict",       // cross-site in prod
    secure: IS_PROD,                             // HTTPS-only in prod
    path: "/",
  });

  return token;
};
