# ShareBase completion roadmap

This plan compares the current ShareBase repo with the contributed Rabbit Front and Rabbit Back projects, then maps those lessons onto common MERN Instagram clone patterns. It is written as a Cursor-ready roadmap: each phase can become a small branch/PR.

## Repositories inspected

- **ShareBase**: current workspace repo, `Evernight27/ShareBase`, branch `Update`.
- **Rabbit Front**: `knnyshn/Rabbit-Front`, React client. GitHub contributors list includes `Evernight27`.
- **Rabbit Back**: `knnyshn/Rabbit-Back`, Django REST backend. GitHub contributors list shows `Evernight27` as the top contributor.
- **Instagram clone references**: public MERN clones such as `jigar-sable/instagram-mern`, `danishali22/mern-instagram-clone`, and `reaperdragon/instagram-mern` were used only for feature benchmarking.

## Baseline comparison

### ShareBase today

- README describes an "Instagram clone using MERN stack".
- Repo currently contains only `server/`; there is no React client yet.
- Backend is an early Express + MongoDB scaffold:
  - `server/server.js` mounts only `/record`.
  - `server/routes/record.js` is still the sample employee-record CRUD route (`name`, `position`, `level`).
  - `server/db/connection.js` connects to MongoDB Atlas but selects an `employees` database.
  - No Instagram domain models, auth, image upload, comments, likes, follows, profiles, tests, or env example exist yet.

### Rabbit Front reference

Rabbit Front is useful as a frontend structure reference, not as a product copy:

- React app under `Client/` with `react-router-dom`.
- Routes for home, login, signup, create post, and post details.
- Components split around product surfaces: `Home`, `Posts`, `PostDetails`, `CreatePost`, `Header`, `Sidebar`, auth forms, vote/comment components.
- Central API helper in `src/api/apiConfig.js`.
- Basic token flow through localStorage and an auth context.
- Consumes backend resources for posts, burrows, comments, and auth.

Lessons to carry into ShareBase:

- Keep a clear API helper instead of scattering raw fetch/axios calls.
- Build page routes early so every feature has a visible place to land.
- Separate page components from reusable components.
- Add auth context/protected routes early, but make token storage and API headers consistent.
- Avoid Rabbit's unfinished patterns: hard-coded production API URL, commented-out auth checks, incomplete form submission, inconsistent token key names, and console logging.

### Rabbit Back reference

Rabbit Back is useful as a backend API and data-model reference, even though ShareBase should remain Node/Express/MongoDB:

- Django REST Framework backend with routers in `rabbit_back/urls.py`.
- Resource routes for `users`, `posts`, `burrows`, `comments`, and `profiles`.
- JWT login/refresh/verify via `rest_framework_simplejwt`.
- Signup endpoint at `api/auth/signup/`.
- Domain models in `rabbit/models.py`:
  - `Profile` belongs to a user and tracks total carrots.
  - `Burrow` groups posts.
  - `Post` belongs to a user and burrow, with title/content/carrots.
  - `Comment` belongs to a user and post, with content/carrots.
- Serializers in `rabbit/serializers.py` embed nested `comments`, `burrow`, and `user` in post responses.

Lessons to carry into ShareBase:

- Define the data model before building UI screens.
- Keep backend resources aligned with frontend routes; Rabbit Front expects posts, comments, auth, and grouping resources to exist.
- Use JWT auth from the beginning so create/edit/delete actions can be permission-aware.
- Return nested data where it improves UI rendering, such as post cards/details with author and comment summary.
- Add explicit profile records instead of storing all user-facing fields directly on auth credentials.
- Avoid Rabbit Back's unfinished or unsafe patterns: committed secret key, `DEBUG = True`, `ALLOWED_HOSTS = ['*']`, global CORS allow-all, weak default database credentials, default empty strings on foreign keys, public user CRUD, no permissions on viewsets, commented-out serializer code, and exposed password fields in user serializer output definitions.

### Comparable Instagram clone expectations

MERN Instagram clones commonly include:

- React frontend, usually Vite, React Router, Tailwind/CSS modules, and either Context or Redux Toolkit.
- Express backend with MongoDB, usually Mongoose models.
- JWT signup/login and protected routes.
- User profiles with avatar, bio, followers, following, and profile editing.
- Posts with image upload through Multer + Cloudinary/S3/local storage.
- Feed/explore/profile pages.
- Likes, comments, bookmarks/saves, and delete/edit permissions.
- Search for users/posts.
- Infinite scroll/pagination.
- Realtime chat/notifications with Socket.IO as a later feature.

## Recommended direction

Keep ShareBase as a MERN app. Do not port Rabbit's Django/backend direction or Reddit "burrow" domain. Use Rabbit Front for React app organization and route-first development. Use Rabbit Back for the API/data-model lesson: define resources, serializers/response shapes, auth, profiles, nested post details, and permissions before polishing UI.

## Chosen implementation stack

- **Frontend deployment**: Vercel.
- **Backend deployment**: Render or Railway.
- **Database**: MongoDB Atlas.
- **Images/media**: Cloudinary.
- **Backend data layer**: Mongoose.

## Final implementation guardrails

- **Backend data layer**: Use MongoDB Atlas as the database and Mongoose as the backend modeling layer. ShareBase is still early enough that schemas, validation, refs, population, indexes, and middleware are more valuable than preserving the scaffold's native-driver style.
- **Frontend**: Use Vite + React + React Router. Start with React Context for auth/session state; introduce Redux Toolkit only if shared feed/profile/search state becomes hard to manage.
- **Styling**: Pick one primary styling system. Rabbit Front mixed Bootstrap, Tailwind, and custom CSS; ShareBase should avoid that. Prefer Tailwind or CSS modules consistently.
- **Auth**: Use JWT access tokens with `Authorization: Bearer <token>`, one localStorage key, password hashing with bcrypt, and protected backend middleware.
- **Media**: Use Multer for upload handling. Use Cloudinary for production-style storage, with local/dev fallback only if Cloudinary env vars are absent.
- **Testing**: Each implementation phase should include at least smoke verification. Backend phases should add API tests for the changed routes; frontend phases should at minimum build successfully and cover critical render/auth flows when test setup exists.
- **Deployment**: Keep all service URLs and secrets in env vars. No hard-coded deployed API URLs like Rabbit Front's Heroku URL.

## Design choices to confirm

These are the decisions that should come from the project owner. If no preference is provided, use the recommended default so implementation can continue.

| Decision | Recommended default | Why it matters |
| --- | --- | --- |
| App identity | Keep `ShareBase` as the name. | The name affects README copy, page titles, branding, and env/database naming. |
| MVP product scope | Instagram-style photo sharing: auth, profiles, image posts, feed, explore, likes, comments, follows, saves, and search. | Prevents scope drift into Reddit/Rabbit features or advanced Instagram features too early. |
| Frontend language | JavaScript first, not TypeScript. | The current and Rabbit projects are JavaScript; TypeScript can be added later if desired. |
| Backend modeling | Mongoose on MongoDB Atlas. | This keeps MongoDB as the database while giving the Express app schemas, validation, refs, and cleaner relationship queries. |
| Styling system | Tailwind CSS. | Fast for responsive Instagram-like UI and avoids Rabbit Front's mixed Bootstrap/Tailwind/custom styling. |
| UI originality | Instagram-inspired layout, not a pixel-perfect clone. | Keeps the project legally and creatively safer while still demonstrating the same feature set. |
| Media storage | Cloudinary for deployed media; local fallback for development. | Instagram clones depend on reliable image upload/display. |
| Auth login fields | Email or username plus password. | Common Instagram-clone behavior; supports username-based identity and email-based recovery later. |
| Profile privacy | Public profiles for MVP. | Private accounts require request/approval flows and more feed rules. |
| Feed ranking | Start chronological; add ranking later. | Easier to verify while core relationships and pagination are being built. |
| Realtime features | Post-MVP only. | Chat, typing status, and notifications add Socket.IO complexity after the core app works. |
| Deployment target | Vercel for frontend; Render or Railway for backend; MongoDB Atlas for DB. | Vercel is not ideal for long-running Express APIs with upload handling; separating frontend/backend is simpler. |
| Seed/demo data | Add seed script after models stabilize. | Useful for screenshots and testing, but early seed data churns if schemas are still changing. |

## Additional implementation defaults

These choices do not need to block implementation unless the owner wants a different direction.

| Area | Default | Reason |
| --- | --- | --- |
| Repo layout | Root README/scripts with `server/` and `client/` directories. | Matches MERN conventions and keeps deployment targets separate. |
| Package manager | npm. | Current server already uses `package-lock.json`; avoid mixing lockfiles. |
| API namespace | `/api` for MVP. | Simple and matches the existing roadmap; add `/api/v1` later only if versioning becomes useful. |
| API response shape | JSON with consistent success payloads and `{ error: { message } }` for failures. | Makes frontend error/loading handling predictable. |
| Auth token storage | localStorage access token for MVP, with no refresh token in browser storage; HttpOnly cookies are the later hardening option. | Matches Rabbit Front's simpler auth flow while reducing token blast radius and leaving a path to stronger production auth. |
| CORS | Environment-based frontend origin allowlist. | Safer than Rabbit Back's allow-all CORS while still working across Vercel and local dev. |
| Pagination | `limit` plus cursor or page parameter for feed/explore endpoints. | Prevents large feed responses and prepares for infinite scroll. |
| Upload limits | Images only, with size/type validation before Cloudinary upload. | Protects the API and gives users clearer errors. |
| Testing tools | Vitest/React Testing Library for frontend; Vitest or Jest with Supertest for backend. | Fits JavaScript/Vite/Express without heavy setup. |
| Accessibility | Mobile-first responsive UI with semantic buttons/forms, labels, alt text, and keyboard-friendly modals. | Instagram-like layouts can become inaccessible quickly without early guardrails. |

## Security and storage hardening

These requirements should be treated as part of implementation, not post-launch cleanup.

### Secrets and environment

- Never commit `.env`, MongoDB connection strings, JWT secrets, Cloudinary secrets, API keys, or service credentials.
- Keep `server/.env.example` limited to placeholder names and safe example values.
- Use separate environment variables for local, preview, and production deployments.
- Use a least-privilege MongoDB Atlas database user for the app.
- Do not expose Cloudinary API secret or upload signing logic in the frontend.

### Authentication and authorization

- Store only password hashes, never plaintext passwords; use bcrypt with an explicit cost factor.
- Use a strong `JWT_SECRET`, token expiration, and consistent `Authorization: Bearer <token>` parsing.
- Rate-limit auth endpoints and avoid detailed login errors that reveal whether username/email exists.
- Require ownership/authorization checks for editing or deleting posts, comments, profiles, follows, and saved items.
- Exclude `passwordHash`, reset tokens, and private fields from all user/profile API responses.
- If switching to HttpOnly cookie auth later, add CSRF protection and `SameSite`/`Secure` cookie settings.

### API and database safety

- Validate and normalize all request bodies, params, query strings, ObjectIds, pagination inputs, and file metadata.
- Prevent NoSQL/query selector injection by whitelisting allowed filter fields and avoiding direct use of untrusted objects in Mongo queries.
- Add unique indexes for username/email and follower/following pairs.
- Use consistent JSON error responses without leaking stack traces or secrets.
- Use environment-based CORS origin allowlists instead of `*`.
- Add baseline Express security middleware such as `helmet` and request size limits.

### Frontend/XSS safety

- Treat captions, comments, bios, display names, and search text as untrusted user-generated content.
- Do not use `dangerouslySetInnerHTML` for user content.
- If markdown/rich text is added later, sanitize it with a trusted sanitizer before rendering.
- Keep localStorage token usage minimal; avoid storing profile-private data or refresh tokens there.
- Add a Content Security Policy during production hardening.

### Image and storage safety

- Upload images through backend-controlled Multer + Cloudinary flow.
- Validate file MIME type, extension, and size before sending to Cloudinary; reject non-image uploads.
- Store Cloudinary `public_id` with each post so images can be deleted or replaced safely.
- Delete or invalidate Cloudinary assets when posts are deleted, when replacement uploads fail, or during account deletion workflows.
- Use Cloudinary folders/prefixes per environment, such as `sharebase/dev` and `sharebase/prod`.
- Avoid trusting client-provided Cloudinary URLs; use backend-generated/stored URLs from successful uploads.
- Consider stripping metadata or using Cloudinary transformations to avoid exposing unnecessary image metadata.

## Environment variable checklist

Use these names as the starting contract for `.env.example`, Render/Railway backend env vars, and Vercel frontend env vars. Values should differ by local, preview, and production environment.

### Backend

- `PORT`
- `NODE_ENV`
- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CLIENT_ORIGIN`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_FOLDER`
- `MAX_UPLOAD_BYTES`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX_REQUESTS`

### Frontend

- `VITE_API_BASE_URL`
- `VITE_APP_NAME`

## Definition of done for each implementation PR

Each phase should leave the repo in a better, runnable state:

- The changed app or package installs with npm without lockfile churn from another package manager.
- Relevant tests, build, or smoke checks are run and documented in the PR/summary.
- New env vars are added to `.env.example` without real secrets.
- API changes are reflected in the README or roadmap if they affect setup or usage.
- User-generated content is validated/sanitized according to the security section.
- Logs do not include secrets, tokens, passwords, database URIs, or Cloudinary secrets.
- The branch is committed, pushed, and the PR description is updated with test results.

## Operational readiness defaults

These are lightweight defaults for debugging and deployment without adding heavy infrastructure too early:

- Add a backend `/api/health` route in Phase 0 that returns service status without requiring auth or exposing secrets.
- Add a database connectivity check only when useful, and keep it separate from the simple health route if it could slow or fail cold starts.
- Use safe request logging in development and production; avoid logging request bodies for auth, profile, upload, or token-bearing requests.
- Add centralized backend error handling so unexpected errors return a safe generic message while details stay in server logs.
- Add frontend error/loading/empty states for feed, profile, post detail, auth, and upload flows.
- Add a React error boundary before deployment polish so UI failures do not blank the whole app.
- Keep deployment rollback simple by deploying frontend and backend separately and documenting each service's build/start command.
- Track known post-MVP operational tools, such as Sentry or another error monitor, but do not block MVP implementation on them.

## Deployment options

Recommended default:

- **Frontend**: Vercel.
- **Backend**: Render Web Service or Railway.
- **Database**: MongoDB Atlas.
- **Media**: Cloudinary.

Other good options:

| Layer | Options | Notes |
| --- | --- | --- |
| Frontend | Vercel, Netlify, Cloudflare Pages, Render Static Site | Any of these work for Vite/React. Vercel is the smoothest default; Netlify is also simple; Cloudflare Pages is fast but has slightly more config decisions. |
| Backend | Render, Railway, Fly.io, Heroku, DigitalOcean App Platform | Render/Railway are best defaults for an Express API. Fly.io and DigitalOcean are stronger when you want more infrastructure control. |
| Database | MongoDB Atlas | Keep Atlas regardless of backend host so the app remains portable. |
| Media | Cloudinary, AWS S3, local dev storage | Cloudinary is simplest for an MVP Instagram clone. S3 is a later production option. |

Avoid deploying the Express API as frontend serverless functions during the MVP unless there is a specific reason. A normal long-running Node service is easier for auth middleware, uploads, logs, and future Socket.IO.

## Rabbit-to-Instagram translation

Rabbit concepts should inform structure, not product language:

| Rabbit concept | ShareBase Instagram equivalent | Keep or change |
| --- | --- | --- |
| Burrow | Explore grouping, hashtags, or categories | Do not expose "burrow" in ShareBase MVP; add hashtags later if needed. |
| Carrots/votes | Likes | Use Instagram-style likes, not up/down voting. |
| Post title/content | Image post with caption | Replace title-first post model with required media and optional caption. |
| Comments | Comments | Keep the relationship pattern, add ownership checks. |
| Profile total carrots | Profile stats | Use post count, followers, following, and maybe total likes later. |
| Nested post serializer | Post detail/feed response shape | Keep nested author/comment summary where it improves UI. |

## Cursor execution plan

### Phase 0: fix current ShareBase errors and repo hygiene

Goal: remove scaffold errors and make the repo ready for repeatable full-stack work.

Cursor prompt:

> Fix the current ShareBase scaffold before adding product features. Add a root `.gitignore`, root README setup notes, `server/.env.example`, and useful npm scripts. Replace sample employee naming with ShareBase naming where safe, fix Express response status ordering, add a `/api/health` route, and make MongoDB connection/database config environment-driven. Do not add the React client or full product models yet.

Current ShareBase issues to fix first:

- `server/routes/record.js` uses sample employee fields (`name`, `position`, `level`) instead of ShareBase domain data.
- `server/server.js` mounts `/record`; future routes should live under `/api`.
- `server/db/connection.js` selects the `employees` database; use a ShareBase database name from env.
- Several responses call `res.send(...).status(...)`; Express status must be set before sending.
- `dotenv.config({ path: "./config.env" })` depends on process working directory; prefer standard `.env` loading from the server directory or documented root execution.
- No root `.gitignore`, so dependency folders and secrets are not protected by repo policy.
- No `server/.env.example`, despite relying on `ATLAS_URI`.
- `server/package.json` has no useful `start`/`dev` script and the test script intentionally fails.

Acceptance checks:

- `node_modules`, `.env`, build output, and logs are ignored.
- README explains local server setup.
- Server can start with documented env vars.
- Health route returns 200.
- Basic safe request/error logging is available without logging secrets or request bodies.
- No secrets are committed.

### Phase 1: backend foundation

Goal: replace the sample employee CRUD with Instagram domain APIs.

Cursor prompt:

> Refactor the Express backend from scaffold routes into `/api` routes for ShareBase. Use Rabbit Back's resource-first approach, but adapt the domain to Instagram. Add Mongoose models backed by MongoDB Atlas for users, profiles, posts, comments, follows, likes, and saved posts. Include centralized error handling, request validation, and permission-aware controllers.

Recommended model shape:

- `User`: username, email, passwordHash, avatarUrl, bio, timestamps.
- `Profile` or embedded public profile fields: displayName, website, counts cached only if needed.
- `Post`: author ref, imageUrl, imagePublicId, caption, likes refs, comments refs or virtual relation, savedBy refs, timestamps.
- `Comment`: post ref, author ref, text, timestamps.
- `Follow`: follower ref, following ref, unique compound index.
- Optional later: `Notification`, `Conversation`, `Message`, `Hashtag`.

Suggested API surface:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/users/me`
- `GET /api/users/:username`
- `PATCH /api/users/me`
- `POST /api/users/:id/follow`
- `DELETE /api/users/:id/follow`
- `GET /api/posts/feed`
- `GET /api/posts/explore`
- `GET /api/posts/:id`
- `POST /api/posts`
- `PATCH /api/posts/:id`
- `DELETE /api/posts/:id`
- `POST /api/posts/:id/like`
- `DELETE /api/posts/:id/like`
- `POST /api/posts/:id/comments`
- `DELETE /api/posts/:id/comments/:commentId`
- `POST /api/posts/:id/save`
- `DELETE /api/posts/:id/save`

Acceptance checks:

- Employee `records` route is removed or isolated from production routes.
- Database name and collection names match ShareBase.
- Post detail responses include useful nested author/comment data, similar to Rabbit Back's nested serializer pattern.
- Auth-protected routes reject unauthenticated requests.
- Invalid ObjectIds and missing records return proper 400/404 responses.
- Request validation, safe error handling, CORS allowlist, request size limits, and security middleware are in place.

### Phase 2: authentication and user profiles

Goal: implement the identity layer before content.

Cursor prompt:

> Add JWT authentication to the ShareBase backend and a React auth flow. Build register/login/logout, an auth context, protected routes, and profile pages. Learn from Rabbit Front's auth context/API helper and Rabbit Back's JWT endpoints, but use one consistent localStorage token key and one API client that automatically attaches `Authorization: Bearer <token>`.

Frontend pages/components:

- `LoginPage`
- `RegisterPage`
- `ProfilePage`
- `EditProfileForm`
- `ProtectedRoute`
- `AuthProvider`
- `api/client`

Acceptance checks:

- A user can register, log in, refresh, and remain authenticated.
- Profile page shows username, avatar placeholder, bio, post count, followers, and following.
- Logout clears token and redirects safely.
- Passwords are hashed, auth routes are rate-limited, private user fields are never returned, and ownership checks are covered by tests.

### Phase 3: frontend shell

Goal: create the app frame before deep feature work.

Cursor prompt:

> Create the ShareBase React frontend with Vite. Add React Router routes for home feed, explore, create post, post detail modal/page, profile, login, and register. Build a responsive Instagram-like layout with top nav/bottom mobile nav/sidebar where appropriate.

Recommended route map:

- `/`
- `/explore`
- `/create`
- `/p/:postId`
- `/:username`
- `/accounts/login`
- `/accounts/register`

Acceptance checks:

- All routes render useful placeholders or connected data.
- Navigation works on mobile and desktop.
- API base URL comes from environment config, not a hard-coded deployed URL.
- Core routes include loading, error, and empty states.

### Phase 4: posts and media

Goal: reach the core Instagram clone experience.

Cursor prompt:

> Implement post creation and display for ShareBase. Add image upload with Multer and Cloudinary. Build create-post UI, feed cards, post details, profile grid, delete/edit permissions, and loading/error states.

Acceptance checks:

- Authenticated users can create posts with an image and caption.
- Feed shows post image, author, caption, like/comment counts, and creation time.
- Profile page shows that user's posts in a grid.
- Only the post owner can edit/delete.
- Upload validation rejects unsupported file types and oversized files, Cloudinary secrets stay backend-only, and stored `public_id`s are deleted when posts are deleted.

### Phase 5: social interactions

Goal: add the interaction loops expected in Instagram clones.

Cursor prompt:

> Add likes, comments, saves/bookmarks, follow/unfollow, and basic user search. Keep backend authorization strict and frontend state updates optimistic only where safe.

Acceptance checks:

- Users can like/unlike without duplicate likes.
- Users can comment and delete only their own comments.
- Users can follow/unfollow from profile/search.
- Feed prioritizes followed users; explore shows broader posts.
- Saved posts are available from the current user's profile.

### Phase 6: polish, quality, and deployment readiness

Goal: make the project presentable and maintainable.

Cursor prompt:

> Add focused tests and production readiness for ShareBase. Cover auth middleware, post CRUD permissions, likes/comments, and critical React flows. Add lint/format scripts, better README documentation, deployment env notes, and seed data for local demos.

Acceptance checks:

- Backend tests cover protected routes and core APIs.
- Frontend smoke tests cover auth and feed rendering.
- README includes screenshots or feature list, setup, env vars, and deployment notes.
- No console logs, dead commented code, or hard-coded production URLs remain.
- Dependency audit, production CORS values, security headers, and secret-free logs are checked before deployment.
- Frontend error boundary and backend centralized error handler are in place.

### Phase 7: post-MVP upgrades

Add these only after the MVP is solid:

- Infinite scrolling/pagination.
- Notifications.
- Direct messaging with Socket.IO.
- Stories/reels.
- Hashtags and mentions.
- Password reset/email verification.
- Image moderation or upload constraints.

## Priority checklist

1. Fix current ShareBase scaffold errors and repo hygiene.
2. Replace `/record` employee CRUD with ShareBase `/api` resources.
3. Add auth and user profiles using the Rabbit Front/Rabbit Back auth lessons.
4. Create a React client with route and component organization learned from Rabbit Front.
5. Add posts with image upload and nested response shapes learned from Rabbit Back.
6. Add feed, explore, post detail, and profile grid.
7. Add likes, comments, follows, saves, and search.
8. Add tests, docs, deployment config, and polish.

## Ready-to-run first Cursor task

Use this as the first implementation prompt after accepting the roadmap:

> Start Phase 0 from `docs/PROJECT_ROADMAP.md`. Fix ShareBase scaffold errors and repo hygiene only. Add `.gitignore`, `server/.env.example`, useful server scripts, a health route, correct Express status/send ordering, environment-driven MongoDB database naming, and documentation updates. Do not add the React client or full Instagram models yet. Commit and push the Phase 0 changes when server startup and the health route are verified.

