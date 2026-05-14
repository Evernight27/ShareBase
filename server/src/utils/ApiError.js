/**
 * Lightweight error class so controllers can `throw new ApiError(404, "Not found")`
 * and the centralized error middleware will respond with the right status.
 */
export default class ApiError extends Error {
  constructor(status, message, { details } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    if (details) this.details = details;
  }
}
