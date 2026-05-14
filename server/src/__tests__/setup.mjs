// Runs in every test file's process before any imports, via the
// `node --import ./src/__tests__/setup.mjs --test` script in package.json.
//
// NODE_ENV and JWT_SECRET are FORCE-SET (not `||=`) because they're
// test-runner internals: an externally set NODE_ENV=production would
// re-enable the auth rate limiter and any test that fires more than 20
// login attempts in 15 minutes would start hitting 429s instead of the
// behavior it actually wants to assert on.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-do-not-use-in-prod";

// ATLAS_URI uses `||=` — mongodb-memory-server sets the real URI in the
// per-file `before` hook; this placeholder only exists so any module that
// touches assertRequiredEnv at import time doesn't trip.
process.env.ATLAS_URI ||= "mongodb://placeholder.invalid/test";
