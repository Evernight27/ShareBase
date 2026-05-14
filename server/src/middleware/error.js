import { isProd } from "../config/env.js";
import ApiError from "../utils/ApiError.js";

export function notFound(req, res, next) {
  next(new ApiError(404, `Not found: ${req.method} ${req.originalUrl}`));
}

// Express identifies error middleware by its 4-arg signature, so `next` must
// stay even though it's only used for the headers-sent fall-through.
export function errorHandler(err, req, res, next) {
  // If the response is already streaming, let Express's default handler
  // abort the connection instead of throwing "Cannot set headers after
  // they are sent" on top of the original error.
  if (res.headersSent) {
    return next(err);
  }

  let status = err.status || err.statusCode || 500;
  let message = err.message || "Internal server error";
  let details = err.details;

  if (err.name === "ValidationError") {
    // Mongoose validation errors -> 400 with field details.
    status = 400;
    details = Object.fromEntries(
      Object.entries(err.errors || {}).map(([k, v]) => [k, v.message]),
    );
    message = "Validation failed";
  } else if (err.code === 11000) {
    // Mongoose duplicate-key errors -> 409.
    status = 409;
    details = err.keyValue;
    message = "Duplicate value";
  } else if (err.name === "CastError") {
    // Mongoose cast errors (bad ObjectId, etc.) -> 400.
    status = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  if (status >= 500) {
    console.error("[error]", err);
  }

  const body = { error: { message } };
  if (details) body.error.details = details;
  if (!isProd && status >= 500) body.error.stack = err.stack;

  res.status(status).json(body);
}
