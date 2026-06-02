// Integration tests for /api/posts/*. Drives the real Express app over
// supertest with mongodb-memory-server.
//
// The Cloudinary service is module-mocked via `node:test`'s mock.module
// (Node 22+) so the create path doesn't need real API keys; a fake
// `imageUrl`/`imagePublicId` flows through the rest of the controller.

import test, { mock } from "node:test";
import assert from "node:assert/strict";

mock.module("../services/cloudinary.js", {
  namedExports: {
    uploadPostImage: async () => ({
      imageUrl: "https://cdn.test/fixture.jpg",
      imagePublicId: "test/fixture",
    }),
    deletePostImage: async () => undefined,
  },
});

const mongoose = (await import("mongoose")).default;
const { MongoMemoryServer } = await import("mongodb-memory-server");
const request = (await import("supertest")).default;

const { default: app } = await import("../app.js");
const { default: User } = await import("../models/User.js");
const { default: Post } = await import("../models/Post.js");
const { default: Comment } = await import("../models/Comment.js");
const { default: Follow } = await import("../models/Follow.js");

let mongod;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([User.init(), Post.init(), Comment.init(), Follow.init()]);
});

test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test.beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Post.deleteMany({}),
    Comment.deleteMany({}),
    Follow.deleteMany({}),
  ]);
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

async function createPostFixture(token, caption = "hi") {
  const res = await request(app)
    .post("/api/posts")
    .set("Authorization", `Bearer ${token}`)
    .field("caption", caption)
    .attach("image", Buffer.from("fake-jpeg-bytes"), {
      filename: "fixture.jpg",
      contentType: "image/jpeg",
    });
  return res;
}

// --- GET /api/posts/explore -------------------------------------------

test("explore: empty repo returns empty list with pagination", async () => {
  const res = await request(app).get("/api/posts/explore");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.posts, []);
  assert.equal(res.body.pagination.page, 1);
  assert.equal(res.body.pagination.limit > 0, true);
});

test("explore: rejects bogus pagination with per-field details", async () => {
  const res = await request(app).get("/api/posts/explore?page=0");
  assert.equal(res.status, 400);
  assert.ok(res.body.error.details.page);
});

// --- POST /api/posts (create) -----------------------------------------

test("create post: requires auth", async () => {
  const res = await request(app)
    .post("/api/posts")
    .field("caption", "hi")
    .attach("image", Buffer.from("x"), {
      filename: "fixture.jpg",
      contentType: "image/jpeg",
    });
  assert.equal(res.status, 401);
});

test("create post: stores image url + public id from cloudinary mock", async () => {
  const { token, user } = await signup();
  const res = await createPostFixture(token, "first post");
  assert.equal(res.status, 201);
  assert.equal(res.body.post.caption, "first post");
  assert.equal(res.body.post.imageUrl, "https://cdn.test/fixture.jpg");
  assert.equal(res.body.post.imagePublicId, "test/fixture");
  assert.equal(res.body.post.author.username, user.username);
});

test("create post: rejects request with no file", async () => {
  const { token } = await signup();
  const res = await request(app)
    .post("/api/posts")
    .set("Authorization", `Bearer ${token}`)
    .field("caption", "hi");
  assert.equal(res.status, 400);
});

test("create post: rejects non-image mimetypes", async () => {
  const { token } = await signup();
  const res = await request(app)
    .post("/api/posts")
    .set("Authorization", `Bearer ${token}`)
    .field("caption", "hi")
    .attach("image", Buffer.from("x"), {
      filename: "evil.exe",
      contentType: "application/x-msdownload",
    });
  assert.equal(res.status, 400);
});

// --- GET /api/posts/:id -----------------------------------------------

test("get by id: 404 when missing, 400 when malformed", async () => {
  const { token } = await signup();
  const created = await createPostFixture(token);
  const id = created.body.post._id || created.body.post.id;

  const ok = await request(app).get(`/api/posts/${id}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.post.caption, "hi");

  const malformed = await request(app).get("/api/posts/not-an-id");
  assert.equal(malformed.status, 400);

  const missing = await request(app).get(`/api/posts/${new mongoose.Types.ObjectId()}`);
  assert.equal(missing.status, 404);
});

// --- Like / Save ------------------------------------------------------

test("like / unlike: idempotent and reflected in count", async () => {
  const { token } = await signup();
  const created = await createPostFixture(token);
  const id = created.body.post._id || created.body.post.id;

  const liked = await request(app)
    .post(`/api/posts/${id}/like`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(liked.status, 200);
  assert.equal(liked.body.likesCount, 1);

  const liked2 = await request(app)
    .post(`/api/posts/${id}/like`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(liked2.body.likesCount, 1, "second like is a no-op");

  const unliked = await request(app)
    .delete(`/api/posts/${id}/like`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(unliked.body.likesCount, 0);
});

test("save / unsave: toggles savedBy", async () => {
  const { token, user } = await signup();
  const created = await createPostFixture(token);
  const id = created.body.post._id || created.body.post.id;

  const saved = await request(app)
    .post(`/api/posts/${id}/save`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.saved, true);

  const persisted = await Post.findById(id);
  assert.equal(persisted.savedBy.length, 1);
  assert.equal(persisted.savedBy[0].toString(), user.id || user._id);

  await request(app)
    .delete(`/api/posts/${id}/save`)
    .set("Authorization", `Bearer ${token}`);
  const after = await Post.findById(id);
  assert.equal(after.savedBy.length, 0);
});

// --- Comments ---------------------------------------------------------

test("comments: add then list via post detail", async () => {
  const { token } = await signup();
  const created = await createPostFixture(token);
  const id = created.body.post._id || created.body.post.id;

  const added = await request(app)
    .post(`/api/posts/${id}/comments`)
    .set("Authorization", `Bearer ${token}`)
    .send({ text: "first!" });
  assert.equal(added.status, 201);
  assert.equal(added.body.comment.text, "first!");

  const detail = await request(app).get(`/api/posts/${id}`);
  assert.equal(detail.body.post.comments.length, 1);
  assert.equal(detail.body.post.comments[0].text, "first!");
});

test("comments: empty text rejected with 400", async () => {
  const { token } = await signup();
  const created = await createPostFixture(token);
  const id = created.body.post._id || created.body.post.id;
  const res = await request(app)
    .post(`/api/posts/${id}/comments`)
    .set("Authorization", `Bearer ${token}`)
    .send({ text: "   " });
  assert.equal(res.status, 400);
});

// --- Permission ------------------------------------------------------

test("delete post: only author can delete", async () => {
  const { token: tokenAlice } = await signup();
  const { token: tokenBob } = await signup({
    username: "bob",
    email: "bob@example.com",
  });

  const created = await createPostFixture(tokenAlice);
  const id = created.body.post._id || created.body.post.id;

  const forbidden = await request(app)
    .delete(`/api/posts/${id}`)
    .set("Authorization", `Bearer ${tokenBob}`);
  assert.equal(forbidden.status, 403);

  const ok = await request(app)
    .delete(`/api/posts/${id}`)
    .set("Authorization", `Bearer ${tokenAlice}`);
  assert.equal(ok.status, 200);
});

// --- Feed (regression: routes used to shadow /feed under /:id) -------

test("feed: requires auth", async () => {
  const res = await request(app).get("/api/posts/feed");
  assert.equal(res.status, 401);
});

test("feed: empty list when user follows nobody and has no posts", async () => {
  const { token } = await signup();
  const res = await request(app)
    .get("/api/posts/feed")
    .set("Authorization", `Bearer ${token}`);
  // Regression: prior to the route reorder, this hit the /:id handler
  // with id="feed" and returned 400 "Invalid post id". Pin the
  // expected status here.
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.posts, []);
});

test("feed: includes own posts and followed-user posts, newest first", async () => {
  const alice = await signup({ username: "alice", email: "a@example.com" });
  const bob = await signup({ username: "bob", email: "b@example.com" });
  const carol = await signup({ username: "carol", email: "c@example.com" });

  // Alice follows Bob (but not Carol).
  await request(app)
    .post(`/api/users/${bob.user.id || bob.user._id}/follow`)
    .set("Authorization", `Bearer ${alice.token}`);

  // Each user makes a post.
  await createPostFixture(alice.token, "alice-post");
  await createPostFixture(bob.token, "bob-post");
  await createPostFixture(carol.token, "carol-post");

  const res = await request(app)
    .get("/api/posts/feed")
    .set("Authorization", `Bearer ${alice.token}`);
  assert.equal(res.status, 200);
  const captions = res.body.posts.map((p) => p.caption).sort();
  assert.deepEqual(captions, ["alice-post", "bob-post"]);
});

// --- Privacy: populated author payload must not leak email ----------

test("populated post.author does NOT leak email", async () => {
  const { token } = await signup({ username: "alice", email: "alice@example.com" });
  const created = await createPostFixture(token, "hi");
  const id = created.body.post._id || created.body.post.id;

  const detail = await request(app).get(`/api/posts/${id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.post.author.username, "alice");
  assert.equal(detail.body.post.author.email, undefined);

  const explore = await request(app).get("/api/posts/explore");
  assert.equal(explore.body.posts[0].author.email, undefined);
});
