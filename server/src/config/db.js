import mongoose from "mongoose";
import env from "./env.js";

mongoose.set("strictQuery", true);

// Indexed by mongoose.connection.readyState; index 99 ("uninitialized") and
// any future state fall back to "unknown" via the lookup helper below.
const READY_STATE_LABELS = ["disconnected", "connected", "connecting", "disconnecting"];

/**
 * Snapshot of the mongoose connection's current readiness. Centralized here
 * so callers (health routes, logging, future readiness gates) don't each
 * reach into mongoose internals and re-map the state codes.
 */
export function getDbReadiness() {
  const state = mongoose.connection.readyState;
  return {
    state,
    label: READY_STATE_LABELS[state] ?? "unknown",
    ready: state === 1,
  };
}

/**
 * Connect to MongoDB Atlas using the URI from env.
 * Resolves with the active mongoose connection on success; the caller is
 * responsible for deciding what to do on failure (server.js exits the
 * process so we don't start an API that can't talk to its database).
 */
export async function connectDB() {
  if (!env.ATLAS_URI) {
    throw new Error("ATLAS_URI is not set");
  }

  const conn = await mongoose.connect(env.ATLAS_URI, {
    serverSelectionTimeoutMS: 10_000,
  });

  // Surface dropped connections in the logs once the app is running.
  mongoose.connection.on("error", (err) => {
    console.error("[mongo] connection error:", err.message);
  });
  mongoose.connection.on("disconnected", () => {
    console.warn("[mongo] disconnected");
  });

  return conn;
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
