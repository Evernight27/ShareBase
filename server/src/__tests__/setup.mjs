// Runs in every test file's process before any imports, via the
// `node --import ./src/__tests__/setup.mjs --test` script in package.json.
// We use `||=` so a real env var (set by a CI job, say) wins over the
// defaults below.
process.env.NODE_ENV ||= "test";
process.env.JWT_SECRET ||= "test-secret-do-not-use-in-prod";
// ATLAS_URI is set per-test once mongodb-memory-server boots; we provide
// a placeholder here only so any module that touches assertRequiredEnv
// at import time doesn't trip.
process.env.ATLAS_URI ||= "mongodb://placeholder.invalid/test";
