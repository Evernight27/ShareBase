import jwt from "jsonwebtoken";

import env from "../config/env.js";

/**
 * Sign an access token for the given user id.
 * Throws synchronously if JWT_SECRET is unset (so a misconfigured deploy
 * fails the first request loudly rather than minting unsignable tokens).
 */
export function signToken(userId, { expiresIn = env.JWT_EXPIRES_IN } = {}) {
  if (!env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set; cannot sign tokens");
  }
  return jwt.sign({ sub: String(userId) }, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn,
  });
}

/**
 * Verify a token and return its payload. Throws JsonWebTokenError or
 * TokenExpiredError on failure — both are mapped to 401 by the central
 * error handler.
 */
export function verifyToken(token) {
  if (!env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not set; cannot verify tokens");
  }
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
}
