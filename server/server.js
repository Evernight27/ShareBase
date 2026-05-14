import app from "./src/app.js";
import env, { assertRequiredEnv } from "./src/config/env.js";
import { connectDB, disconnectDB } from "./src/config/db.js";

// Last-resort safety nets. With these in place a stray rejection logs
// something useful before the process dies instead of vanishing silently.
process.on("unhandledRejection", (reason) => {
  console.error("[fatal] unhandledRejection:", reason);
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("[fatal] uncaughtException:", err);
  process.exit(1);
});

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

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[shutdown] received ${signal}, closing gracefully...`);

    const forceExit = setTimeout(() => {
      console.error("[shutdown] timeout exceeded, forcing exit");
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    server.close(async (closeErr) => {
      if (closeErr) console.error("[shutdown] server close error:", closeErr);
      try {
        await disconnectDB();
      } catch (dbErr) {
        console.error("[shutdown] mongo disconnect error:", dbErr);
      }
      clearTimeout(forceExit);
      process.exit(closeErr ? 1 : 0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start();
