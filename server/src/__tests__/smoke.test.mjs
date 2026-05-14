// Smoke tests for the Phase 1 backend foundation.
//
// Two separate listeners:
//
//   1. realAppServer — the production app from src/app.js. Used to verify
//      the routes and 404 path users actually hit.
//   2. errorAppServer — a tiny throwaway Express app that wires up ONLY
//      the same notFound + errorHandler middleware plus a handful of
//      synthetic routes that throw the error shapes we want to assert on.
//      This lets us cover the error-envelope mapping (ApiError, Mongoose
//      ValidationError / 11000 / CastError, the headers-sent guard)
//      without polluting the real app with test-only routes.
//
// Run with `npm test`.

import test from "node:test";
import assert from "node:assert/strict";
import express from "express";

import app from "../app.js";
import ApiError from "../utils/ApiError.js";
import { errorHandler, notFound } from "../middleware/error.js";

// Build a minimal app whose only purpose is to feed crafted errors into
// the real errorHandler so we can inspect what comes out the other side.
function buildErrorApp() {
  const a = express();

  a.get("/__throw/:code", (req, res, next) => {
    next(new ApiError(Number(req.params.code), `boom ${req.params.code}`));
  });

  a.get("/__double-send", (req, res, next) => {
    res.status(200).json({ first: true });
    next(new Error("late error after response"));
  });

  a.get("/__validation", (req, res, next) => {
    const err = new Error("Validation failed (synthetic)");
    err.name = "ValidationError";
    err.errors = {
      username: { message: "username is required" },
      email: { message: "email is invalid" },
    };
    next(err);
  });

  a.get("/__duplicate", (req, res, next) => {
    const err = new Error("E11000 duplicate key");
    err.code = 11000;
    err.keyValue = { email: "taken@example.com" };
    next(err);
  });

  a.get("/__cast", (req, res, next) => {
    const err = new Error("Cast failed");
    err.name = "CastError";
    err.path = "_id";
    err.value = "not-an-objectid";
    next(err);
  });

  a.use(notFound);
  a.use(errorHandler);
  return a;
}

function listen(target) {
  return new Promise((resolve) => {
    const server = target.listen(0, () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

test("real app: status, health, 404", async (t) => {
  const { server, base } = await listen(app);
  t.after(() => new Promise((r) => server.close(r)));

  await t.test("GET / returns status payload", async () => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { name: "ShareBase API", status: "ok" });
  });

  await t.test("GET /api/health/live is always 200 with no-store cache", async () => {
    const res = await fetch(`${base}/api/health/live`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-store");
    const body = await res.json();
    assert.equal(body.status, "ok");
    assert.equal(typeof body.uptime, "number");
    assert.match(body.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  });

  await t.test("GET /api/health/ready returns 503 when DB disconnected", async () => {
    const res = await fetch(`${base}/api/health/ready`);
    assert.equal(res.status, 503);
    assert.equal(res.headers.get("cache-control"), "no-store");
    const body = await res.json();
    assert.equal(body.status, "degraded");
    assert.equal(body.db, "disconnected");
  });

  await t.test("GET /api/health mirrors /ready when DB disconnected", async () => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.status, "degraded");
    assert.equal(body.db, "disconnected");
  });

  await t.test("unknown route -> 404 with error envelope", async () => {
    const res = await fetch(`${base}/no-such-route`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.match(body.error.message, /Not found:/);
  });
});

test("error handler: envelope mapping for synthetic errors", async (t) => {
  const { server, base } = await listen(buildErrorApp());
  t.after(() => new Promise((r) => server.close(r)));

  await t.test("ApiError(403) -> 403 with declared message", async () => {
    const res = await fetch(`${base}/__throw/403`);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.message, "boom 403");
    assert.equal(body.error.details, undefined);
  });

  await t.test("Mongoose ValidationError -> 400 with per-field details", async () => {
    const res = await fetch(`${base}/__validation`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.message, "Validation failed");
    assert.deepEqual(body.error.details, {
      username: "username is required",
      email: "email is invalid",
    });
  });

  await t.test("Duplicate key (11000) -> 409 with keyValue details", async () => {
    const res = await fetch(`${base}/__duplicate`);
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.error.message, "Duplicate value");
    assert.deepEqual(body.error.details, { email: "taken@example.com" });
  });

  await t.test("Mongoose CastError -> 400 with path/value in message", async () => {
    const res = await fetch(`${base}/__cast`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error.message, "Invalid _id: not-an-objectid");
  });

  await t.test("late error after headers sent does not crash the process", async () => {
    const res = await fetch(`${base}/__double-send`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { first: true });
    // If the headers-sent guard were missing this connection would have
    // crashed and the next request would either hang or refuse. Reaching
    // here proves we recovered.
    const followup = await fetch(`${base}/__throw/418`);
    assert.equal(followup.status, 418);
  });
});
