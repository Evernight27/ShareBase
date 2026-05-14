// Tiny smoke test for the Phase 1 backend foundation. Runs the express app
// in-process on an ephemeral port and asserts the headline behaviors:
//
//   - GET /              -> 200 status JSON
//   - GET /api/health/live   -> 200 (always)
//   - GET /api/health/ready  -> 503 when DB not connected
//   - GET /api/health        -> 503 when DB not connected
//   - GET /nope          -> 404 via the centralized error handler
//   - thrown ApiError    -> mapped to its declared status with the right envelope
//   - res.headersSent guard prevents double-send crashes
//
// Run with: `node --test src/__tests__/smoke.test.mjs` (no extra deps).

import test from "node:test";
import assert from "node:assert/strict";

import app from "../app.js";
import ApiError from "../utils/ApiError.js";

// Install a couple of extra routes used only by these tests, before the
// 404 + errorHandler middleware would normally swallow them. Express lets
// us add routes after .use(notFound) by mounting them via .use(...) on a
// fresh sub-router, but the simpler trick is to expose them through the
// existing app: prepend a router that runs before notFound.
//
// We do this by re-importing and re-wiring is overkill — instead, mount
// the test routes on an ad-hoc express() that delegates to app for
// everything else.
import express from "express";
import { errorHandler, notFound } from "../middleware/error.js";

const testApp = express();
testApp.use(express.json());
testApp.get("/__throw/:code", (req, res, next) => {
  next(new ApiError(Number(req.params.code), `boom ${req.params.code}`));
});
testApp.get("/__double-send", (req, res, next) => {
  res.status(200).json({ first: true });
  next(new Error("late error after response"));
});
// Delegate everything else to the real app.
testApp.use(app);
// Re-attach error handling because the inner app already terminated the
// chain with its own notFound + errorHandler, but errors from our test
// routes still need handling at this outer level.
testApp.use(notFound);
testApp.use(errorHandler);

function listen() {
  return new Promise((resolve) => {
    const server = testApp.listen(0, () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

test("smoke: routes + error handling", async (t) => {
  const { server, base } = await listen();
  t.after(() => new Promise((r) => server.close(r)));

  await t.test("GET / returns status payload", async () => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { name: "ShareBase API", status: "ok" });
  });

  await t.test("GET /api/health/live is always 200", async () => {
    const res = await fetch(`${base}/api/health/live`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ok");
    assert.equal(typeof body.uptime, "number");
  });

  await t.test("GET /api/health/ready returns 503 when DB disconnected", async () => {
    const res = await fetch(`${base}/api/health/ready`);
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.status, "degraded");
    assert.equal(body.db, "disconnected");
  });

  await t.test("GET /api/health returns 503 when DB disconnected", async () => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.status, "degraded");
  });

  await t.test("unknown route -> 404 with error envelope", async () => {
    const res = await fetch(`${base}/no-such-route`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.match(body.error.message, /Not found:/);
  });

  await t.test("ApiError(403) -> 403 with declared message", async () => {
    const res = await fetch(`${base}/__throw/403`);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.message, "boom 403");
  });

  await t.test("late error after headers sent does not crash", async () => {
    const res = await fetch(`${base}/__double-send`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { first: true });
    // If the headers-sent guard were missing this request would hang or
    // the server would crash. Reaching this line means we recovered.
    const followup = await fetch(`${base}/`);
    assert.equal(followup.status, 200);
  });
});
