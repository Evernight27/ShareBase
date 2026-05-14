import app from "./src/app.js";
import env, { assertRequiredEnv } from "./src/config/env.js";
import { connectDB, disconnectDB } from "./src/config/db.js";

async function start() {
  try {
    assertRequiredEnv();
  } catch (err) {
    console.error(`[startup] ${err.message}`);
    process.exit(1);
  }

  try {
    await connectDB();
    console.log("[mongo] connected");
  } catch (err) {
    console.error("[mongo] initial connection failed:", err.message);
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    console.log(`[http] ShareBase API listening on http://localhost:${env.PORT}`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[shutdown] received ${signal}, closing gracefully...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    // Force-exit if close hangs.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start();
