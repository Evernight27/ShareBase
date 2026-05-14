import mongoose from "mongoose";
import env from "./env.js";

mongoose.set("strictQuery", true);

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
