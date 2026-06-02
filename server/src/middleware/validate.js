import ApiError from "../utils/ApiError.js";

/**
 * Build an Express middleware that validates `req.body` (or another
 * request segment) against a Zod schema. On success the parsed value
 * replaces the original, so downstream handlers see a clean, typed
 * shape with defaults applied and unknown keys stripped.
 *
 * On failure, throws an ApiError(400) whose `details` is a per-field
 * map suitable for direct rendering in form UIs:
 *
 *   { error: { message: "Validation failed",
 *              details: { username: "username is required", ... } } }
 */
export default function validate(schema, segment = "body") {
  return (req, res, next) => {
    const result = schema.safeParse(req[segment]);
    if (result.success) {
      req[segment] = result.data;
      return next();
    }
    const details = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || segment;
      // First message per field wins — keeps the response small and
      // matches what a typical form UI displays per input.
      if (!(key in details)) details[key] = issue.message;
    }
    next(new ApiError(400, "Validation failed", { details }));
  };
}
