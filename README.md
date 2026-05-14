# ShareBase

Instagram-style social app built on the MERN stack.

> Status: **active development**. Phases 1–2 are done — the backend
> foundation is in place and the auth surface (signup / login / me) is
> live with JWT, bcrypt password hashing, per-IP rate limiting, and a
> Zod-validated request layer. Uploads and the React client land in
> Phases 3–5. See [`PLAN.md`](./PLAN.md) for the full roadmap.

## Tech stack

- **Server:** Node.js + Express, Mongoose (MongoDB Atlas), Helmet, Morgan,
  CORS, dotenv, **bcryptjs + jsonwebtoken** for auth, **zod** for request
  validation, **express-rate-limit** for credential-touching endpoints.
  Multer + Cloudinary image uploads land in Phase 3.
- **Client:** Vite + React 18 + Tailwind + React Query (added in Phase 5).
- **Database:** MongoDB Atlas. Tests use `mongodb-memory-server`.

## Repo layout

```
ShareBase/
├── PLAN.md              Multi-phase roadmap for the project
├── server/              Express API
│   ├── server.js        Entry: validates env, connects DB, starts HTTP server
│   ├── src/
│   │   ├── app.js              Express app (middleware + routes, no listen)
│   │   ├── config/             env.js, db.js
│   │   ├── models/             User.js, Post.js, Comment.js (Phase 3 uses Post/Comment)
│   │   ├── middleware/         auth.js (protect), error.js, validate.js (zod)
│   │   ├── controllers/        auth.controller.js
│   │   ├── routes/             auth.routes.js, health.routes.js
│   │   ├── utils/              asyncHandler.js, ApiError.js, jwt.js
│   │   └── __tests__/          setup.mjs, smoke.test.mjs, auth.test.mjs
│   ├── .env.example     Copy to .env and fill in
│   └── package.json
└── client/              (added in Phase 5)
```

## Running the server locally

Requires **Node ≥ 20** (the test runner uses Node's built-in test discovery,
and the server uses `server.closeIdleConnections()` from 18.2+ during
graceful shutdown).

```bash
cd server
cp .env.example .env       # then fill in ATLAS_URI and JWT_SECRET
npm install
npm run dev                # nodemon
# or
npm start                  # plain node
```

The API serves:

- `GET /` — name + status JSON.
- `GET /api/health/live` — liveness; always 200 as long as the process is up.
- `GET /api/health/ready` — readiness; 200 only when Mongo is connected,
  otherwise 503 with `{ status: "degraded", db: "..." }`.
- `GET /api/health` — back-compat combined check that mirrors `/ready`.

### Auth (Phase 2)

All three endpoints return errors in the shared
`{ error: { message, details? } }` envelope.

- `POST /api/auth/signup` — body: `{ username, email, password, name? }`.
  201 → `{ token, user }`. 400 on validation, 409 on duplicate
  username/email with a per-field `details` hint.
- `POST /api/auth/login` — body: `{ identifier, password }`. `identifier`
  matches either email or username (case-insensitive). 200 → `{ token, user }`.
  401 with the generic `"Invalid credentials"` for both unknown user and
  wrong password (so the endpoint doesn't double as an existence oracle).
- `GET /api/auth/me` — requires `Authorization: Bearer <token>`. 200 →
  `{ user }`. 401 for missing / malformed / invalid / expired / orphan
  tokens.

Signup and login are behind a per-IP rate limiter (20 requests / 15 min)
disabled in `NODE_ENV=test`.

Future domain routes (`/api/posts`, `/api/users`) land in Phases 3–4.

## Tests

`npm test` runs the `node:test` suite — **30 assertions** across two
files:

- `smoke.test.mjs` — the real routes (`/`, three health endpoints with
  `Cache-Control: no-store`, 404 path) and the centralized error handler
  envelope mapping for `ApiError`, Mongoose `ValidationError` /
  duplicate-key (`11000`) / `CastError`, and the `res.headersSent` guard.
- `auth.test.mjs` — full signup → login → me flow against an in-process
  `mongodb-memory-server`, plus negative paths: validation errors,
  duplicate username, duplicate email, wrong password, unknown user,
  case-insensitive identifier, expired token, tampered token, orphan
  token, malformed Authorization header.

```bash
cd server
npm test
```

`npm test` is `node --import ./src/__tests__/setup.mjs --test`. The
setup file seeds `NODE_ENV=test` and a test `JWT_SECRET` before any
imports; Node's built-in `--test` discovery picks up
`**/*.test.{js,mjs,cjs}` under the package and skips `node_modules`.

## Environment variables

See [`server/.env.example`](./server/.env.example). Required for boot:

- `ATLAS_URI` — MongoDB Atlas connection string. The server refuses to
  start without it.
- `JWT_SECRET` — used by the auth routes from Phase 2 on. Production
  hard-fails without it; dev prints a warning and keeps booting so
  non-auth endpoints stay reachable.

Generate a secret for local dev with:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Security note

`server/config.env` was previously committed with live Atlas credentials.
It has been removed from the repo and added to `.gitignore`, but the values
are still visible in git history — **rotate the Atlas DB password and any
secrets that were in that file**.
