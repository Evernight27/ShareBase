# ShareBase — Roadmap & Cursor Plan

A focused plan to take ShareBase from "boilerplate MongoDB CRUD" to a working
Instagram-style MERN app, derived from a comparison with the user's prior
`Rabbit-Back` / `Rabbit-Front` projects and several reference MERN Instagram
clones.

This file is intentionally written so a Cursor agent can pick a single
phase / checklist item and execute it autonomously.

---

## 1. Current state of ShareBase

Repo: `Evernight27/ShareBase` (branch `Update`).

```
server/
  server.js              Express + cors + dotenv, mounts /record router
  routes/record.js       CRUD on a "records" collection (name/position/level)
  db/connection.js       MongoClient using ATLAS_URI from config.env
  config.env             ATLAS_URI placeholder
  package.json           express, cors, dotenv, mongodb (native driver), ESM
```

Observations:

- The backend is the unmodified MongoDB MERN tutorial scaffold. The schema
  (`name / position / level` on an `employees` DB) has nothing to do with an
  Instagram-style app.
- The native `mongodb` driver is used (no Mongoose). For an Instagram-like
  domain (users, posts, comments, likes, follows) Mongoose schemas + refs are
  much easier to maintain.
- No authentication, no password hashing, no JWT, no validation.
- No image upload pipeline (Multer / Cloudinary / S3).
- No client at all — the `client/` folder does not exist.
- `config.env` is committed; it should be `.gitignored` and an `.env.example`
  added instead.
- Last commit message says "created backend with connection issue" — the
  top-level `await client.connect()` in `db/connection.js` will crash the
  module if `ATLAS_URI` is empty or unreachable. Connection should be lazy /
  guarded.

---

## 2. What to copy from Rabbit-Back / Rabbit-Front

Rabbit-Back (Django + DRF + SimpleJWT) and Rabbit-Front (React 17 + axios +
Context auth) were never finished, but several patterns are worth carrying
over to ShareBase:

Patterns to reuse (translated to MERN):

- **AuthContext + token in `localStorage`** — Rabbit-Front's
  `AuthenticationContext` + `useState(localStorage.getItem("TOKEN"))` is a
  fine starting pattern. Port it to ShareBase as `AuthProvider.jsx`.
- **Axios instance with request interceptor** — Rabbit-Front's
  `src/api/apiConfig.js` attaches the token to every request. Reuse this
  shape; just point `baseURL` at the ShareBase server and send
  `Authorization: Bearer <token>`.
- **Route shape** — `/auth/login`, `/auth/signup`, `/`, `/post/:id`,
  `/create-post`. Add Instagram-specific routes: `/profile/:username`,
  `/explore`, `/feed`.
- **Component tree** — `Home`, `Posts`, `PostDetails`, `CreatePost`,
  `Login/Signup`, `CommentBox`, `Navbar`, `Sidebar`, `Thumbnail` map almost
  1:1 to ShareBase. Replace Rabbit's `VoteButton` (carrots) with a
  `LikeButton` (heart).
- **Data model shape** — Rabbit's `User / Post / Comment` map directly.
  `Burrow` (community) becomes optional; the IG analog would be `Hashtag` or
  is dropped entirely. Replace `carrots: IntegerField` with a `likes: [User]`
  array.

Patterns NOT to reuse:

- Django/DRF backend — stay MERN. Replace with Express + Mongoose + JWT.
- Bootstrap + Redux + Tailwind all at once — pick one styling system
  (Tailwind) and skip Redux until the app is large enough to need it
  (Context + React Query is enough at first).
- React 17 / CRA — start the new client on Vite + React 18.

---

## 3. What the reference Instagram MERN clones do that ShareBase is missing

Looking at `jigar-sable/instagram-mern`, `danishali22/mern-instagram-clone`,
`MrHassanKhan/instagram-mern`, `manikandanraji/instaclone-*`, and
`PankajKumar1947/FullStack-Instagram-Clone`, the common feature checklist is:

Backend:

- JWT auth (access + optional refresh), bcrypt password hashing.
- Mongoose models: `User`, `Post`, `Comment`, optionally `Notification`,
  `Conversation`, `Message`.
- Image upload via Multer to Cloudinary (or S3). Local disk only for dev.
- Endpoints: signup, login, me, follow/unfollow, post create / feed (posts
  from people I follow) / explore (everyone), like/unlike, comment
  add/delete, profile (with post grid + followers/following counts), search
  by username.
- Validation (express-validator or zod) and centralized error handling.
- Rate limiting on auth routes.

Frontend:

- React 18 + Vite, React Router v6, Tailwind, axios (with interceptor),
  React Query or Redux Toolkit Query for server state.
- Pages: Login, Signup, Feed (Home), Explore, Post detail (modal), Profile,
  Edit Profile, Create Post (with image preview + crop), Search.
- Reusable components: `PostCard`, `Comment`, `LikeButton`, `FollowButton`,
  `Avatar`, `Modal`, `Spinner`, `ProtectedRoute`.
- Infinite scroll on feed / explore.
- Optimistic updates for like / follow.

Stretch (only the bigger clones have these):

- Real-time chat with Socket.io.
- Notifications (likes / follows / comments).
- Stories.
- Double-tap-to-like, post-save (bookmark).

---

## 4. Target architecture for ShareBase

```
ShareBase/
├── server/
│   ├── src/
│   │   ├── config/         db.js, env.js, cloudinary.js
│   │   ├── models/         User.js, Post.js, Comment.js
│   │   ├── middleware/     auth.js, error.js, upload.js
│   │   ├── controllers/    auth.controller.js, user.controller.js,
│   │   │                   post.controller.js, comment.controller.js
│   │   ├── routes/         auth.routes.js, user.routes.js,
│   │   │                   post.routes.js, comment.routes.js
│   │   ├── utils/          jwt.js, asyncHandler.js
│   │   └── app.js          express app (no listen)
│   ├── server.js           app.listen
│   ├── .env.example
│   └── package.json        + mongoose, jsonwebtoken, bcryptjs, multer,
│                             cloudinary, express-validator, morgan, helmet
└── client/                 Vite + React 18 + Tailwind
    ├── src/
    │   ├── api/            axios instance + per-resource modules
    │   ├── context/        AuthContext
    │   ├── hooks/          useAuth, useInfiniteFeed
    │   ├── components/     PostCard, LikeButton, FollowButton, Comment,
    │   │                   Avatar, Modal, ProtectedRoute, Navbar
    │   ├── pages/          Login, Signup, Feed, Explore, Profile,
    │   │                   PostDetail, CreatePost, EditProfile
    │   ├── App.jsx
    │   └── main.jsx
    └── package.json
```

Suggested env variables:

```
ATLAS_URI=
JWT_SECRET=
JWT_EXPIRES_IN=7d
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
PORT=5050
CLIENT_ORIGIN=http://localhost:5173
```

---

## 5. Phased plan for Cursor

Each phase below is sized so a Cursor agent can complete and PR it
independently. Phases are ordered by dependency.

### Phase 0 — Repo hygiene (small)

- [ ] Add `.gitignore` (node_modules, .env, build, dist, .DS_Store, etc.).
- [ ] Move `server/config.env` to `server/.env`, add `server/.env.example`
      with the keys from §4, and remove `config.env` from the index.
- [ ] Update `server/package.json` to add a `start` and `dev` script
      (`node server.js` and `nodemon server.js`); add `nodemon` as
      devDependency.
- [ ] Update root `README.md`: short intro, tech stack, how to run server
      and (eventually) client.

### Phase 1 — Fix the backend foundation (small/medium)

- [ ] Refactor `server/server.js` into `server/src/app.js` (express app) +
      `server/server.js` (listen + connect-then-listen).
- [ ] Rewrite `db/connection.js` as `src/config/db.js` exporting an async
      `connectDB()` that uses Mongoose (`mongoose.connect(process.env.ATLAS_URI)`).
      No top-level await; surface errors and exit on initial connect failure.
- [ ] Add `helmet`, `morgan`, JSON body limit, and a `/health` route.
- [ ] Add a centralized error middleware and an `asyncHandler` util.
- [ ] Delete `routes/record.js` (the employees CRUD) once the new structure
      is in place, or keep it temporarily behind a `/legacy` mount until
      Phase 2 is merged.

### Phase 2 — Domain models & auth (medium)

- [ ] `models/User.js`: `username` (unique, lowercased), `email` (unique),
      `password` (hashed, `select: false`), `name`, `bio`, `avatarUrl`,
      `followers: [ObjectId]`, `following: [ObjectId]`, timestamps. Add a
      pre-save bcrypt hook and a `comparePassword` method.
- [ ] `models/Post.js`: `author: ObjectId(User)`, `imageUrl`, `imagePublicId`,
      `caption`, `likes: [ObjectId(User)]`, `comments: [ObjectId(Comment)]`,
      timestamps.
- [ ] `models/Comment.js`: `author`, `post`, `text`, timestamps.
- [ ] `utils/jwt.js`: sign / verify helpers.
- [ ] `middleware/auth.js`: `protect` middleware that reads
      `Authorization: Bearer <token>`, verifies, attaches `req.user`.
- [ ] `controllers/auth.controller.js` + `routes/auth.routes.js`:
      `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me`.
- [ ] Hook router into `app.js` at `/api`.
- [ ] Smoke-test with `curl` / Postman: signup → login → me.

### Phase 3 — Posts, likes, comments (medium)

- [ ] `middleware/upload.js`: Multer memory storage + Cloudinary upload
      helper. Configurable via env; if Cloudinary keys are missing, fall
      back to a local `uploads/` folder so dev works offline.
- [ ] `controllers/post.controller.js`:
  - `POST /api/posts` (auth, multipart `image` + `caption`)
  - `GET /api/posts/feed` (auth, posts from `req.user.following` + self,
    newest first, paginated `?page=&limit=`)
  - `GET /api/posts/explore` (paginated all posts)
  - `GET /api/posts/:id` (populated with author + comments + comment authors)
  - `DELETE /api/posts/:id` (auth, must be owner; also delete from
    Cloudinary)
  - `POST /api/posts/:id/like` and `DELETE /api/posts/:id/like` (toggle).
- [ ] `controllers/comment.controller.js`:
  - `POST /api/posts/:id/comments`
  - `DELETE /api/comments/:id`

### Phase 4 — Users, profiles, follow (small/medium)

- [ ] `controllers/user.controller.js`:
  - `GET /api/users/:username` — profile + post grid + counts.
  - `PATCH /api/users/me` — edit name / bio / avatar.
  - `POST /api/users/:id/follow` and `DELETE /api/users/:id/follow`.
  - `GET /api/users/search?q=` — basic regex on username/name.
- [ ] Make sure follow/unfollow updates both sides atomically.

### Phase 5 — Spin up the client (medium)

- [ ] In repo root: `npm create vite@latest client -- --template react`.
- [ ] Install: `react-router-dom`, `axios`, `@tanstack/react-query`,
      `tailwindcss`, `lucide-react` (icons), `clsx`.
- [ ] Configure Tailwind. Add a base layout with `Navbar` + outlet.
- [ ] `src/api/apiConfig.js` — port from Rabbit-Front; `baseURL` from
      `import.meta.env.VITE_API_URL`; request interceptor adds
      `Authorization: Bearer ${token}` from localStorage.
- [ ] `src/context/AuthContext.jsx` — port from Rabbit-Front's
      `AuthProvider`. Persist user + token; expose `login`, `signup`,
      `logout`.
- [ ] `components/ProtectedRoute.jsx` — redirect to `/login` if no user.
- [ ] Pages (minimum to be useful):
  - `Login`, `Signup`
  - `Feed` (`/`) — list `PostCard`s from `/posts/feed`.
  - `PostDetail` (`/post/:id`) — image + comments + like.
  - `CreatePost` (`/create`) — file input with preview, caption, submit.
  - `Profile` (`/u/:username`) — header + 3-column grid of post thumbs.
- [ ] Use React Query for all server state; mutations should invalidate
      relevant queries (`feed`, `post(id)`, `profile(username)`).

### Phase 6 — Polish (small, pick & choose)

- [ ] Optimistic like and follow.
- [ ] Infinite scroll on feed / explore (`useInfiniteQuery`).
- [ ] Edit profile page + avatar upload.
- [ ] Search bar in `Navbar` calling `/users/search`.
- [ ] Loading skeletons and empty states.
- [ ] 404 page and toast notifications.

### Phase 7 — Stretch (optional, only after 0–6 are solid)

- [ ] Notifications model + bell icon (likes / follows / comments).
- [ ] Bookmarks / saved posts.
- [ ] Socket.io DMs (`Conversation`, `Message`).
- [ ] Stories.
- [ ] Deploy: server on Render/Fly, client on Vercel/Netlify, images on
      Cloudinary, DB on MongoDB Atlas.

---

## 6. Conventions for Cursor while executing this plan

- One phase = one branch = one PR. Branch names: `cursor/phase-N-short-slug-8a23`.
- Keep PRs small enough to review (< ~500 LOC diff when possible).
- Do not commit `.env`. Always update `.env.example` when adding new env vars.
- Backend response shape: `{ data, error }` or REST-ish raw JSON — pick one
  in Phase 1 and stick with it.
- All protected routes go through `middleware/auth.js`. No ad-hoc
  `jwt.verify` calls in controllers.
- Mongoose: use `.lean()` for read-only queries that are sent to the client.
- Frontend: no direct `fetch` calls outside `src/api/`. All server state
  goes through React Query.
- Add at least a happy-path test (supertest for backend, Vitest + RTL for a
  couple of components) starting in Phase 3.

---

## 7. Immediate next step (recommended first PR)

Execute **Phase 0 + Phase 1** in a single PR titled
"chore(server): repo hygiene + restructure backend for Instagram domain".
That clears the connection bug, removes the misleading `records/employees`
boilerplate, and sets up the folder layout that Phases 2–4 expect — without
yet introducing any product features. After that, Phase 2 (auth + models)
becomes a clean, isolated PR.
