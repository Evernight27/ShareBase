import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { verifyToken } from "../utils/jwt.js";

/**
 * Reads `Authorization: Bearer <token>`, verifies the JWT, loads the
 * referenced user, and attaches it as `req.user`.
 *
 * Throws 401 for missing / malformed / invalid / expired tokens, or for
 * tokens that reference a user that no longer exists (handles the case
 * where a token survives a user deletion).
 *
 * `verifyToken` throws `JsonWebTokenError` / `TokenExpiredError`; the
 * central error handler maps both to 401.
 */
export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new ApiError(401, "Missing or malformed Authorization header");
  }

  const payload = verifyToken(token);
  const user = await User.findById(payload.sub);
  if (!user) {
    throw new ApiError(401, "Token references a user that no longer exists");
  }

  req.user = user;
  req.userId = user._id;
  next();
});
