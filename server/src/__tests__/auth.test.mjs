// Phase 2 integration + unit tests. Spins up an in-memory Mongo via
// mongodb-memory-server, connects mongoose to it, then drives the real
// /api/auth/* endpoints over supertest.
//
// JWT_SECRET / NODE_ENV are set by ./setup.mjs (loaded via --import in
// the npm test script), which is why static imports below work.

import test from "node:test";
import assert from "node:assert/strict";

import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

import app from "../app.js";
import User from "../models/User.js";
import { signToken, verifyToken } from "../utils/jwt.js";

let mongod;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test.beforeEach(async () => {
  await User.deleteMany({});
});

// --- POST /api/auth/signup ---------------------------------------------

test("signup: creates user, returns token and stripped user", async () => {
  const res = await request(app).post("/api/auth/signup").send({
    username: "alice",
    email: "alice@example.com",
    password: "correcthorsebatterystaple",
    name: "Alice",
  });
  assert.equal(res.status, 201);
  assert.equal(typeof res.body.token, "string");
  assert.ok(res.body.token.split(".").length === 3, "looks like a JWT");
  assert.equal(res.body.user.username, "alice");
  assert.equal(res.body.user.email, "alice@example.com");
  assert.equal(res.body.user.name, "Alice");
  assert.equal(res.body.user.password, undefined, "password must not leak");

  // Persisted with a hashed password (never the plaintext).
  const persisted = await User.findOne({ username: "alice" }).select("+password");
  assert.notEqual(persisted.password, "correcthorsebatterystaple");
  assert.ok(persisted.password.startsWith("$2"), "bcrypt-shaped hash");
});

test("signup: normalizes username + email to lowercase", async () => {
  const res = await request(app).post("/api/auth/signup").send({
    username: "BoB",
    email: "BoB@Example.COM",
    password: "12345678",
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.user.username, "bob");
  assert.equal(res.body.user.email, "bob@example.com");
});

test("signup: rejects bad body with per-field details", async () => {
  const res = await request(app).post("/api/auth/signup").send({
    username: "!!",
    email: "not-an-email",
    password: "short",
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.message, "Validation failed");
  assert.match(res.body.error.details.username, /username must be/);
  assert.match(res.body.error.details.email, /email is invalid/);
  assert.match(res.body.error.details.password, /at least 8/);
});

test("signup: rejects duplicate username with 409 + field hint", async () => {
  await User.create({
    username: "carol",
    email: "carol@example.com",
    password: "password1",
  });
  const res = await request(app).post("/api/auth/signup").send({
    username: "carol",
    email: "other@example.com",
    password: "password2",
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.details.username, "username already taken");
});

test("signup: rejects duplicate email with 409 + field hint", async () => {
  await User.create({
    username: "dan",
    email: "dan@example.com",
    password: "password1",
  });
  const res = await request(app).post("/api/auth/signup").send({
    username: "other",
    email: "dan@example.com",
    password: "password2",
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.details.email, "email already registered");
});

// --- POST /api/auth/login ----------------------------------------------

async function makeUser(overrides = {}) {
  return User.create({
    username: "eve",
    email: "eve@example.com",
    password: "password1",
    ...overrides,
  });
}

test("login: by email succeeds and returns token", async () => {
  await makeUser();
  const res = await request(app).post("/api/auth/login").send({
    identifier: "eve@example.com",
    password: "password1",
  });
  assert.equal(res.status, 200);
  assert.equal(typeof res.body.token, "string");
  assert.equal(res.body.user.username, "eve");
});

test("login: by username succeeds", async () => {
  await makeUser();
  const res = await request(app).post("/api/auth/login").send({
    identifier: "eve",
    password: "password1",
  });
  assert.equal(res.status, 200);
});

test("login: case-insensitive identifier matching", async () => {
  await makeUser();
  const res = await request(app).post("/api/auth/login").send({
    identifier: "Eve@EXAMPLE.com",
    password: "password1",
  });
  assert.equal(res.status, 200);
});

test("login: wrong password returns 401 with generic message", async () => {
  await makeUser();
  const res = await request(app).post("/api/auth/login").send({
    identifier: "eve",
    password: "wrong-password",
  });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.message, "Invalid credentials");
});

test("login: unknown user returns same 401 (no existence oracle)", async () => {
  const res = await request(app).post("/api/auth/login").send({
    identifier: "ghost",
    password: "whatever",
  });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.message, "Invalid credentials");
});

// --- GET /api/auth/me --------------------------------------------------

test("me: returns the authenticated user", async () => {
  const user = await makeUser();
  const token = signToken(user._id);
  const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.user.username, "eve");
  assert.equal(res.body.user.password, undefined);
});

test("me: missing header returns 401 + 'Missing or malformed'", async () => {
  const res = await request(app).get("/api/auth/me");
  assert.equal(res.status, 401);
  assert.match(res.body.error.message, /Missing or malformed/);
});

test("me: wrong scheme returns 401", async () => {
  const res = await request(app).get("/api/auth/me").set("Authorization", "Basic abc");
  assert.equal(res.status, 401);
});

test("me: malformed token returns 401 'Invalid token' (not specific)", async () => {
  const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer not.a.jwt");
  assert.equal(res.status, 401);
  assert.equal(res.body.error.message, "Invalid token");
});

test("me: expired token returns 401 'Token expired'", async () => {
  const user = await makeUser();
  const token = signToken(user._id, { expiresIn: "-1s" });
  const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 401);
  assert.equal(res.body.error.message, "Token expired");
});

test("me: token for a deleted user returns 401", async () => {
  const user = await makeUser();
  const token = signToken(user._id);
  await User.deleteOne({ _id: user._id });
  const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 401);
  assert.match(res.body.error.message, /no longer exists/);
});

// --- Unit-ish checks ----------------------------------------------------

test("jwt: sign / verify round trip carries the user id in `sub`", () => {
  const id = "507f1f77bcf86cd799439011";
  const token = signToken(id);
  const payload = verifyToken(token);
  assert.equal(payload.sub, id);
  assert.equal(typeof payload.exp, "number");
  assert.equal(typeof payload.iat, "number");
});

test("jwt: tampered token throws JsonWebTokenError", () => {
  const token = signToken("507f1f77bcf86cd799439011");
  const [h, p] = token.split(".");
  const tampered = `${h}.${p}.deadbeef`;
  assert.throws(() => verifyToken(tampered), { name: "JsonWebTokenError" });
});
