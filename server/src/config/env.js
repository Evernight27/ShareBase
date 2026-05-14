import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from server/.env (preferred) and fall back to server/config.env
// for backwards compatibility with the original tutorial scaffold.
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", "..", "config.env") });

function parsePort(raw, fallback = 5050) {
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 0 || n > 65535) {
    throw new Error(`Invalid PORT: ${JSON.stringify(raw)} (must be an integer in 0-65535)`);
  }
  return n;
}

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parsePort(process.env.PORT),
  ATLAS_URI: process.env.ATLAS_URI || "",
  JWT_SECRET: process.env.JWT_SECRET || "",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",
};

export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

/**
 * Throw early if a required env var is missing.
 * Called from server.js before connecting / listening so we fail fast with a
 * readable message instead of crashing deep inside mongoose / jwt.
 */
export function assertRequiredEnv() {
  const missing = [];
  if (!env.ATLAS_URI) missing.push("ATLAS_URI");
  // JWT_SECRET is unused until Phase 2 (auth) lands. We hard-require it
  // in production so a deploy without it fails fast, and only print a
  // soft warning in dev so the server still boots for local API work
  // that doesn't need auth yet.
  if (!env.JWT_SECRET) {
    if (isProd) {
      missing.push("JWT_SECRET");
    } else {
      console.warn(
        "[startup] JWT_SECRET is not set. Auth routes (Phase 2+) will refuse to sign tokens.",
      );
    }
  }

  if (missing.length) {
    throw new Error(
      `Missing required env vars: ${missing.join(", ")}. ` +
        `Copy server/.env.example to server/.env and fill them in.`,
    );
  }
}

export default env;
