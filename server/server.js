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

// HTTP server handle, populated once app.listen() returns. Declared at
// module scope so the shutdown handler (registered before connectDB)
// can deal with a signal that arrives before we're listening yet.
let server = null;
let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[shutdown] received ${signal}, closing gracefully...`);

  const forceExit = setTimeout(() => {
    console.error("[shutdown] timeout exceeded, forcing exit");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  const finish = async (closeErr) => {
    if (closeErr) console.error("[shutdown] server close error:", closeErr);
    try {
      await disconnectDB();
    } catch (dbErr) {
      console.error("[shutdown] mongo disconnect error:", dbErr);
    }
    clearTimeout(forceExit);
    process.exit(closeErr ? 1 : 0);
  };

  if (server) {
    // Closing idle keepalive sockets first lets server.close() return
    // promptly instead of waiting the full keepAliveTimeout (Node 18.2+).
    server.closeIdleConnections?.();
    server.close(finish);
  } else {
    // Signal arrived before app.listen() ran (e.g. during the mongoose
    // handshake). Nothing to close on the HTTP side; just disconnect and
    // exit so we don't leave a half-open mongo connection behind.
    finish(null);
  }
}

// Register signals up front so a SIGTERM during startup is handled
// gracefully instead of falling back to Node's default kill-the-process
// behavior in the middle of a TLS handshake.
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

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

  server = app.listen(env.PORT, () => {
    console.log(`[http] ShareBase API listening on http://localhost:${env.PORT}`);
  });

  // Cloud load balancers commonly hold idle connections for 60-75s. Node's
  // default keepAliveTimeout is 5s, which causes a race where the LB sends
  // a request on a socket Node just closed and the client sees a 502.
  // Per Node docs, headersTimeout must be strictly greater than
  // keepAliveTimeout.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
}

start();
