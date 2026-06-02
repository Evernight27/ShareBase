import { v2 as cloudinary } from "cloudinary";

import env, { isCloudinaryConfigured } from "../config/env.js";
import ApiError from "../utils/ApiError.js";

// Configure once at module load. The SDK silently no-ops when keys are
// missing, so we always pull through `assertConfigured()` before
// touching the API and surface a 503 to the client instead of an
// opaque upstream error.
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

function assertConfigured() {
  if (!isCloudinaryConfigured()) {
    throw new ApiError(503, "Image upload is not configured on this server");
  }
}

/**
 * Upload a multer in-memory file buffer to Cloudinary, namespaced by user.
 * Resolves to `{ imageUrl, imagePublicId }` so the controller can persist
 * exactly what the model stores.
 *
 * Wraps the upload-stream callback in a Promise so the controller can
 * `await` it and let the central error middleware turn rejections into
 * a 502 envelope with a useful message.
 */
export async function uploadPostImage(file, userId) {
  assertConfigured();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${env.CLOUDINARY_FOLDER}/posts/${userId}`,
        resource_type: "image",
        // Cloudinary will auto-pick the most efficient format and
        // quality for the requesting client; this is a no-op for the
        // uploader and a major bandwidth win for delivery.
        transformation: [{ quality: "auto", fetch_format: "auto" }],
      },
      (err, result) => {
        if (err || !result) {
          reject(new ApiError(502, "Image upload failed"));
          return;
        }
        resolve({
          imageUrl: result.secure_url,
          imagePublicId: result.public_id,
        });
      },
    );
    stream.end(file.buffer);
  });
}

/**
 * Best-effort delete. Used as a compensating action when the post
 * write that follows an upload fails, and on post deletion. We don't
 * propagate the error: a stale image is non-fatal and we don't want
 * the user-visible request to fail because of an orphan-cleanup
 * problem.
 */
export async function deletePostImage(publicId) {
  if (!publicId || !isCloudinaryConfigured()) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (err) {
    console.error(`[cloudinary] destroy failed for ${publicId}:`, err.message);
  }
}
