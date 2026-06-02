# ShareBase

Instagram-style social app built on the MERN stack.

> Status: **active development**. Phases 1–3 are landed — the backend
> foundation, the auth surface (signup / login / me) with JWT, bcrypt,
> per-IP rate limiting, and zod-validated requests, **plus** the
> posts / users domain routes (image upload via Cloudinary, likes,
> saves, comments, follows). The Vite + React + Tailwind client is in
> [`client/`](./client). See
> [`docs/PROJECT_ROADMAP.md`](./docs/PROJECT_ROADMAP.md) for the full
> roadmap.

## Tech stack

- **Server:** Node.js + Express, Mongoose (MongoDB Atlas), Helmet, Morgan,
  CORS, dotenv, **bcryptjs + jsonwebtoken** for auth, **zod** for request
  validation, **express-rate-limit** for credential-touching endpoints,
  **multer + cloudinary** for image uploads.
- **Client:** Vite + React 19 + Tailwind v4 + React Router 7.
- **Database:** MongoDB Atlas. Tests use `mongodb-memory-server`.

## Repo layout

```
ShareBase/
├── docs/
│   └── PROJECT_ROADMAP.md    Multi-phase roadmap for the project
├── server/                   Express API
│   ├── server.js             Entry: validates env, connects DB, starts HTTP
│   ├── src/
│   │   ├── app.js            Express app (middleware + routes, no listen)
│   │   ├── config/           env.js, db.js
│   │   ├── models/           User, Post, Comment, Follow
│   │   ├── middleware/       auth (protect), error, validate (zod), upload (multer)
│   │   ├── controllers/      auth, posts, users
│   │   ├── routes/           auth, health, posts, users
│   │   ├── services/         cloudinary
│   │   ├── utils/            asyncHandler, ApiError, jwt
│   │   └── __tests__/        setup, smoke, auth, posts, users
│   ├── .env.example          Copy to .env and fill in
│   └── package.json
└── client/                   React + Vite + Tailwind UI
    ├── index.html
    ├── src/
    │   ├── main.jsx, App.jsx, index.css
    │   ├── api/client.js     fetch wrapper, JWT, error envelope
    │   ├── auth/             AuthProvider, authContext (useAuth)
    │   ├── components/       Layout, ProtectedRoute, PostCard, PostGrid, EmptyState
    │   ├── hooks/            useApiResource (load + cache fetches)
    │   └── pages/            HomeFeed, Explore, CreatePost, PostDetail,
    │                         Profile, Login, Register, NotFound
    └── package.json
```

## Running the server locally

Requires **Node ≥ 20** (the test runner uses Node's built-in test
discovery, and the server uses `server.closeIdleConnections()` from
18.2+ during graceful shutdown). Test runs use Node's
`--experimental-test-module-mocks` flag (Node 22+ recommended).

```bash
cd server
cp .env.example .env       # then fill in ATLAS_URI and JWT_SECRET
npm install
npm run dev                # nodemon
# or
npm start                  # plain node
```

## Running the client locally

```bash
cd client
cp .env.example .env       # defaults already point at http://localhost:5050/api
npm install
npm run dev                # vite dev server on http://localhost:5173
```

## API surface

All error responses share the
`{ error: { message, details? } }` envelope.

### Health

- `GET /` — name + status JSON.
- `GET /api/health/live` — always 200 while the process is up.
- `GET /api/health/ready` — 200 when Mongo is connected, 503 otherwise.
- `GET /api/health` — back-compat combined check that mirrors `/ready`.

### Auth (Phase 2)

- `POST /api/auth/signup` — `{ username, email, password, name? }` → 201 `{ token, user }`. Usernames must match `^[a-z0-9._]{3,30}$` and may not be a reserved router segment (`me`, `search`, `explore`, `feed`, `create`, `accounts`, `admin`, etc.).
- `POST /api/auth/login` — `{ identifier, password }` (identifier = email or username) → 200 `{ token, user }`.
- `GET /api/auth/me` — `Authorization: Bearer <token>` → 200 `{ user }`.

Signup and login are behind a per-IP rate limiter (20 requests / 15 min)
disabled in `NODE_ENV=test`.

### Posts (Phase 3)

- `GET /api/posts/explore` — public, paginated newest-first. Authenticated callers (`Authorization: Bearer`) additionally get `viewerHasLiked` / `viewerHasSaved` booleans on each post.
- `GET /api/posts/feed` — auth, posts from followed users + self.
- `GET /api/posts/user/:username` — public, posts authored by that user.
- `GET /api/posts/:id` — public, post detail with populated author / comments. `viewerHasLiked` / `viewerHasSaved` populated for authed callers. `savedBy` is intentionally NOT in the response — bookmarks are private.
- `POST /api/posts` — auth, multipart `image` + `caption` → uploads to Cloudinary.
- `PATCH /api/posts/:id` — auth, edit caption (author only).
- `DELETE /api/posts/:id` — auth, deletes post + comments + Cloudinary asset (author only).
- `POST /api/posts/:id/like`, `DELETE /api/posts/:id/like` — auth, idempotent.
- `POST /api/posts/:id/save`, `DELETE /api/posts/:id/save` — auth, idempotent.
- `POST /api/posts/:id/comments` — auth, `{ text }`.
- `DELETE /api/posts/:id/comments/:commentId` — auth (comment author only).

### Users (Phase 4)

- `GET /api/users/search?q=` — public, prefix-match on username.
- `GET /api/users/:username` — public, profile + `{ posts, followers, following }` counts. Authed callers also get `viewerIsFollowing` and `isSelf` booleans for follow-button state.
- `PATCH /api/users/me` — auth, update `name`, `bio`, `avatarUrl`.
- `POST /api/users/:id/follow`, `DELETE /api/users/:id/follow` — auth, idempotent.

## Tests

`npm test` (in `server/`) runs the `node:test` suite — **72 tests
across four files**:

- `smoke.test.mjs` — real routes (`/`, three health endpoints with
  `Cache-Control: no-store`, 404 path) and the centralized error
  handler envelope mapping (`ApiError`, Mongoose `ValidationError` /
  `11000` / `CastError`, `res.headersSent` guard).
- `auth.test.mjs` — full signup → login → me flow against
  `mongodb-memory-server`, plus negative paths.
- `posts.test.mjs` — explore / create / get-by-id / like / save /
  comments / delete-permissions, with Cloudinary module-mocked.
- `users.test.mjs` — search, profile + stats, profile patch, follow /
  unfollow + follower counts.

```bash
cd server
npm test
```

The setup file (`__tests__/setup.mjs`) seeds `NODE_ENV=test` and a test
`JWT_SECRET` before any imports; the `--experimental-test-module-mocks`
flag enables `mock.module` for the Cloudinary stub used by the posts
suite.

## Environment variables

See [`server/.env.example`](./server/.env.example) and
[`client/.env.example`](./client/.env.example).

Required for the server to boot:

- `ATLAS_URI` — MongoDB Atlas connection string.
- `JWT_SECRET` — used by the auth routes. Production hard-fails without
  it; dev prints a warning and keeps booting so non-auth endpoints stay
  reachable. Must be at least 32 characters.

Cloudinary is optional (uploads return 503 if unconfigured), but the
three keys are an all-or-nothing group:

- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
  `CLOUDINARY_FOLDER` (defaults to `sharebase`).

Generate a JWT secret for local dev with:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Security note

`server/config.env` was previously committed with live Atlas credentials.
It has been removed from the repo and added to `.gitignore`, but the values
are still visible in git history — **rotate the Atlas DB password and any
secrets that were in that file**.
