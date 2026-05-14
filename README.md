# ShareBase

Instagram-style social app built on the MERN stack.

> Status: **active development**. Phase 1 of the roadmap is done — the
> backend is restructured and the foundation is in place. Auth, models,
> uploads, and the React client land in Phases 2–5. See
> [`PLAN.md`](./PLAN.md) for the full roadmap.

## Tech stack

- **Server:** Node.js + Express, Mongoose (MongoDB Atlas), Helmet, Morgan,
  CORS, dotenv. JWT auth and Multer + Cloudinary image uploads land in
  Phases 2 / 3.
- **Client:** Vite + React 18 + Tailwind + React Query (added in Phase 5).
- **Database:** MongoDB Atlas.

## Repo layout

```
ShareBase/
├── PLAN.md              Multi-phase roadmap for the project
├── server/              Express API
│   ├── server.js        Entry: validates env, connects DB, starts HTTP server
│   ├── src/
│   │   ├── app.js       Express app (middleware + routes, no listen)
│   │   ├── config/      env.js, db.js
│   │   ├── middleware/  error.js (notFound + centralized error handler)
│   │   ├── routes/      health.routes.js (more added in Phase 2+)
│   │   ├── utils/       asyncHandler.js, ApiError.js
│   │   └── __tests__/   smoke.test.mjs (node:test)
│   ├── .env.example     Copy to .env and fill in
│   └── package.json
└── client/              (added in Phase 5)
```

## Running the server locally

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
  Wire this to k8s liveness probes / "is the container alive" checks.
- `GET /api/health/ready` — readiness; 200 only when Mongo is connected,
  otherwise 503 with `{ status: "degraded", db: "..." }`. Use this for
  load-balancer health checks so an instance that lost its DB stops
  receiving traffic.
- `GET /api/health` — backwards-compatible combined check that mirrors
  `/ready` (200 / 503).

Domain routes (`/api/auth`, `/api/posts`, `/api/users`) get added in the
phases described in [`PLAN.md`](./PLAN.md).

## Tests

A `node:test` smoke suite (12 assertions, no extra deps) covers the real
routes (`/`, the three health endpoints with their `Cache-Control: no-store`
header, and the 404 path) plus the centralized error handler's envelope
mapping for `ApiError`, Mongoose `ValidationError`, duplicate-key (`11000`),
`CastError`, and the `res.headersSent` guard.

```bash
cd server
npm test
```

`npm test` is just `node --test`, which auto-discovers `**/*.test.mjs`
under the package and skips `node_modules`. Drop new test files anywhere
in `src/` and they'll be picked up.

## Environment variables

See [`server/.env.example`](./server/.env.example). Required for boot:

- `ATLAS_URI` — MongoDB Atlas connection string
- `JWT_SECRET` — required once Phase 2 (auth) lands; required in production

The server refuses to start if `ATLAS_URI` is missing — better to crash on
startup with a clear message than to limp along returning 500s.

## Security note

`server/config.env` was previously committed with live Atlas credentials.
It has been removed from the repo and added to `.gitignore`, but the values
are still visible in git history — **rotate the Atlas DB password and any
secrets that were in that file**.
