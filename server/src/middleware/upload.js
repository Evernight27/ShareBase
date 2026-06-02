import multer from "multer";

import env from "../config/env.js";
import ApiError from "../utils/ApiError.js";

// Defense in depth: check both MIME and file extension so a renamed
// `.exe` advertised as `image/jpeg` doesn't get past us.
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

function rejectWithApiError(message) {
  // Multer expects the fileFilter callback to receive `(error)`; we
  // pass an ApiError so the central error middleware renders a clean
  // 400 envelope rather than a generic multer message.
  return new ApiError(400, message);
}

export const imageUpload = multer({
  // Buffer the upload in memory rather than landing it on local disk;
  // the cloudinary stream consumes the buffer directly. Combined with
  // the `fileSize` cap below this keeps RAM bounded.
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_UPLOAD_BYTES,
    files: 1,
  },
  fileFilter(_req, file, cb) {
    const lastDot = file.originalname.lastIndexOf(".");
    const ext = lastDot === -1 ? "" : file.originalname.slice(lastDot).toLowerCase();
    if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext)) {
      cb(rejectWithApiError("Only JPEG, PNG, WebP, and GIF images are allowed"));
      return;
    }
    cb(null, true);
  },
});

/**
 * Translate multer's own error class (LIMIT_FILE_SIZE etc.) into our
 * ApiError envelope so the response shape is uniform across "validation
 * failed in zod", "validation failed in multer", and "validation failed
 * in the controller".
 *
 * Mounted directly after the upload middleware on routes that use it.
 */
export function multerErrorHandler(err, _req, _res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(
        new ApiError(
          413,
          `Image is too large (max ${Math.round(env.MAX_UPLOAD_BYTES / 1024)} KB)`,
        ),
      );
    }
    return next(new ApiError(400, err.message));
  }
  next(err);
}
