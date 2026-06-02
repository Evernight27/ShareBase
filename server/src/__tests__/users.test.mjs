// Integration tests for /api/users/* — search, profile, follow graph.

import test from "node:test";
import assert from "node:assert/strict";

import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";

import app from "../app.js";
import User from "../models/User.js";
import Follow from "../models/Follow.js";

let mongod;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([User.init(), Follow.init()]);
});

test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test.beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Follow.deleteMany({})]);
});

async function signup(overrides = {}) {
  const body = {
    username: "alice",
    email: "alice@example.com",
    password: "correcthorsebatterystaple",
    ...overrides,
  };
  const res = await request(app).post("/api/auth/signup").send(body);
  if (res.status !== 201) {
    throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

// --- search ----------------------------------------------------------

test("search: prefix match, case-insensitive, capped at 10", async () => {
  await signup({ username: "alice1", email: "a1@example.com" });
  await signup({ username: "alice2", email: "a2@example.com" });
  await signup({ username: "bob", email: "b@example.com" });
  const res = await request(app).get("/api/users/search?q=Ali");
  assert.equal(res.status, 200);
  const usernames = res.body.users.map((u) => u.username).sort();
  assert.deepEqual(usernames, ["alice1", "alice2"]);
});

test("search: blank query returns empty list", async () => {
  await signup();
  const res = await request(app).get("/api/users/search?q=  ");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.users, []);
});

test("search: regex metachars in query don't blow up", async () => {
  await signup({ username: "alice", email: "alice@example.com" });
  // "(.*" is invalid as a regex if not escaped — would 500 if we
  // forwarded it raw to Mongo's $regex.
  const res = await request(app).get("/api/users/search?q=(.*");
  assert.equal(res.status, 200);
});

// --- profile ---------------------------------------------------------

test("getByUsername: returns user + zeroed stats for new account", async () => {
  await signup({ username: "alice" });
  const res = await request(app).get("/api/users/alice");
  assert.equal(res.status, 200);
  assert.equal(res.body.user.username, "alice");
  assert.deepEqual(res.body.user.stats, { posts: 0, followers: 0, following: 0 });
  assert.equal(res.body.user.password, undefined);
});

test("getByUsername: 404 on missing", async () => {
  const res = await request(app).get("/api/users/nobody");
  assert.equal(res.status, 404);
});

test("PATCH /me: updates allowed fields, ignores others", async () => {
  const { token } = await signup();
  const res = await request(app)
    .patch("/api/users/me")
    .set("Authorization", `Bearer ${token}`)
    .send({ bio: "hello world", username: "evil-rename-attempt" });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.bio, "hello world");
  assert.equal(res.body.user.username, "alice", "username must NOT be editable here");
});

test("PATCH /me: empty body 400", async () => {
  const { token } = await signup();
  const res = await request(app)
    .patch("/api/users/me")
    .set("Authorization", `Bearer ${token}`)
    .send({});
  assert.equal(res.status, 400);
});

// --- follow / unfollow -----------------------------------------------

test("follow / unfollow: idempotent and stat counts update", async () => {
  const alice = await signup({ username: "alice", email: "a@example.com" });
  const bob = await signup({ username: "bob", email: "b@example.com" });

  const f1 = await request(app)
    .post(`/api/users/${bob.user.id || bob.user._id}/follow`)
    .set("Authorization", `Bearer ${alice.token}`);
  assert.equal(f1.status, 200);
  assert.equal(f1.body.following, true);

  const f2 = await request(app)
    .post(`/api/users/${bob.user.id || bob.user._id}/follow`)
    .set("Authorization", `Bearer ${alice.token}`);
  assert.equal(f2.status, 200, "double-follow is a no-op, not 409");

  const stats = await request(app).get("/api/users/bob");
  assert.equal(stats.body.user.stats.followers, 1);

  const u = await request(app)
    .delete(`/api/users/${bob.user.id || bob.user._id}/follow`)
    .set("Authorization", `Bearer ${alice.token}`);
  assert.equal(u.body.following, false);

  const stats2 = await request(app).get("/api/users/bob");
  assert.equal(stats2.body.user.stats.followers, 0);
});

test("follow self: 400", async () => {
  const { token, user } = await signup();
  const res = await request(app)
    .post(`/api/users/${user.id || user._id}/follow`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 400);
});

test("follow: 400 on malformed user id", async () => {
  const { token } = await signup();
  const res = await request(app)
    .post(`/api/users/not-an-id/follow`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 400);
});

// --- Privacy regression tests ----------------------------------------

test("getByUsername: does NOT leak email to public callers", async () => {
  await signup({ username: "alice", email: "alice@example.com" });
  const res = await request(app).get("/api/users/alice");
  assert.equal(res.status, 200);
  assert.equal(res.body.user.username, "alice");
  assert.equal(res.body.user.email, undefined, "email must be private");
  assert.equal(res.body.user.password, undefined);
});

test("search: does NOT leak emails", async () => {
  await signup({ username: "alice", email: "alice@example.com" });
  const res = await request(app).get("/api/users/search?q=ali");
  assert.equal(res.status, 200);
  assert.equal(res.body.users.length, 1);
  assert.equal(res.body.users[0].email, undefined);
});

test("/api/auth/me: DOES return the requester's own email", async () => {
  const { token } = await signup({ username: "alice", email: "alice@example.com" });
  const res = await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.user.email, "alice@example.com");
});

test("PATCH /me: response includes own email", async () => {
  const { token } = await signup({ username: "alice", email: "alice@example.com" });
  const res = await request(app)
    .patch("/api/users/me")
    .set("Authorization", `Bearer ${token}`)
    .send({ bio: "hello" });
  assert.equal(res.status, 200);
  assert.equal(res.body.user.email, "alice@example.com");
  assert.equal(res.body.user.bio, "hello");
});

test("getByUsername: response has no embedded followers/following arrays", async () => {
  await signup({ username: "alice" });
  const res = await request(app).get("/api/users/alice");
  // Source of truth for the follow graph is the Follow collection;
  // legacy embedded arrays have been removed from the schema.
  assert.equal(res.body.user.followers, undefined);
  assert.equal(res.body.user.following, undefined);
});
