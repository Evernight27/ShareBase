import mongoose from "mongoose";

import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { verifyToken } from "../utils/jwt.js";

// Pull the JWT off the Authorization header.
// Returns `null` when the header is absent or malformed; the caller
// decides whether that's a hard 401 (`protect`) or a no-op (`softAuth`).
function readBearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

// Verify a token, load the user, return null if anything is off. The
// caller decides what to do with the null. `protect` throws; `softAuth`
// quietly continues unauthenticated.
async function loadUserFromToken(token) {
  const payload = verifyToken(token);

  // A signed token can carry a non-ObjectId `sub` (test fixtures, or a
  // forged-payload-validated-signature attack via a leaked secret).
  // Reject here so it surfaces as 401 instead of leaking a 400
  // CastError envelope with the path name from the error handler.
  if (typeof payload.sub !== "string" || !mongoose.isValidObjectId(payload.sub)) {
    throw new ApiError(401, "Invalid token payload");
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    throw new ApiError(401, "Token references a user that no longer exists");
  }
  return user;
}

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
  const token = readBearerToken(req);
  if (!token) throw new ApiError(401, "Missing or malformed Authorization header");
  const user = await loadUserFromToken(token);
  req.user = user;
  req.userId = user._id;
  next();
});

/**
 * Best-effort auth: if a valid Bearer token is present, attach
 * `req.user`; if absent, continue unauthenticated. If a token IS
 * present but malformed/expired/forged, reject with 401 — silently
 * swallowing those would let a client think it was anonymous when it
 * really had a stale token, leading to confusing UX downstream.
 *
 * Used on public read routes (`/api/posts/explore`, `/api/posts/:id`,
 * `/api/posts/user/:username`, `/api/users/:username`) so the response
 * can include viewer-derived fields (`viewerHasLiked`,
 * `viewerHasSaved`, `viewerIsFollowing`) when the caller IS logged in,
 * without forcing auth for unauthenticated browsing.
 */
export const softAuth = asyncHandler(async (req, res, next) => {
  const token = readBearerToken(req);
  if (!token) {
    next();
    return;
  }
  const user = await loadUserFromToken(token);
  req.user = user;
  req.userId = user._id;
  next();
});
