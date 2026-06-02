/**
 * Wraps an async Express handler so thrown errors / rejected promises are
 * forwarded to the centralized error middleware instead of leaving the
 * request hanging.
 *
 *   router.get("/", asyncHandler(async (req, res) => { ... }));
 */
export default function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
