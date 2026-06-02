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
  // Mongoose builds schema indexes lazily after connect. Awaiting init()
  // here guarantees the unique indexes on username/email exist before
  // any test runs, so duplicate-key tests can't race the index build on
  // a slow machine.
  await User.init();
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

test("auth responses are no-store (signup, login, me)", async () => {
  // /me, /login, /signup all return user-specific or bearer-tied data;
  // an intermediate cache ignoring Authorization could cross-leak them.
  // The router sets Cache-Control: no-store; assert the header sticks
  // on all three responses (success and error paths).
  const user = await makeUser({ username: "cacher", email: "cacher@example.com", password: "password1" });
  const token = signToken(user._id);
  const meRes = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
  assert.equal(meRes.headers["cache-control"], "no-store");

  const loginRes = await request(app).post("/api/auth/login").send({
    identifier: "cacher",
    password: "password1",
  });
  assert.equal(loginRes.headers["cache-control"], "no-store");

  // Even validation errors must not be cacheable — they leak which
  // fields were valid.
  const badRes = await request(app).post("/api/auth/signup").send({});
  assert.equal(badRes.status, 400);
  assert.equal(badRes.headers["cache-control"], "no-store");
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

test("me: token whose sub is not a valid ObjectId returns 401, not 400", async () => {
  // signToken stringifies the input; nothing stops us minting a token
  // with an arbitrary `sub`. Before the ObjectId guard, this fell
  // through to Mongoose's CastError -> 400 envelope.
  const token = signToken("not-an-objectid");
  const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 401);
  assert.match(res.body.error.message, /Invalid token payload/);
});

// --- Concurrency / DRY regressions -------------------------------------

test("signup: 11000 fallback fires when the pre-check misses", async () => {
  // The controller pre-checks via User.findOne(); only if THAT returns
  // null does the race actually reach User.create() and trigger 11000.
  // To exercise the fallback specifically, we seed the conflicting user
  // AND stub findOne() to return null — simulating a concurrent signup
  // that slipped through the pre-check window.
  await User.create({
    username: "racer",
    email: "racer@example.com",
    password: "password1",
  });

  const originalFindOne = User.findOne.bind(User);
  User.findOne = function stubbed() {
    // Mongoose's findOne returns a Query; reproduce the chain shape the
    // controller calls (.select(...).lean()) and resolve null.
    return {
      select() {
        return this;
      },
      lean() {
        return Promise.resolve(null);
      },
    };
  };

  try {
    const res = await request(app).post("/api/auth/signup").send({
      username: "racer",
      email: "racer2@example.com",
      password: "password2",
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.details.username, "username already taken");
    assert.equal(res.body.error.message, "Account already exists");
  } finally {
    User.findOne = originalFindOne;
  }
});

test("login: timing for unknown user and wrong-password user is in the same ballpark", async () => {
  // Not a strict timing assertion — just a sanity check that the
  // dummy-hash compare actually runs (which makes the two paths
  // share their bcrypt cost). Both legs must be 401s, and both must
  // take a non-trivial amount of time (bcrypt @ rounds=10 > ~30ms).
  await makeUser({ username: "victim", email: "victim@example.com", password: "password1" });

  const start1 = Date.now();
  const r1 = await request(app).post("/api/auth/login").send({
    identifier: "victim",
    password: "wrong-password",
  });
  const t1 = Date.now() - start1;

  const start2 = Date.now();
  const r2 = await request(app).post("/api/auth/login").send({
    identifier: "ghost",
    password: "wrong-password",
  });
  const t2 = Date.now() - start2;

  assert.equal(r1.status, 401);
  assert.equal(r2.status, 401);
  // bcrypt @ 10 rounds is ~30-80ms on a typical CI machine. If the
  // unknown-user path is skipping bcrypt it'll come back in 1-5ms.
  // Threshold is loose to keep the test stable on slow boxes.
  assert.ok(t2 > 20, `unknown-user path must run bcrypt (got ${t2}ms)`);
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
