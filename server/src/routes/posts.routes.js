import { Router } from "express";

import {
  addComment,
  create,
  createCommentSchema,
  createPostSchema,
  explore,
  feed,
  getById,
  like,
  listByUsername,
  remove,
  removeComment,
  save,
  unlike,
  unsave,
  update,
  updatePostSchema,
} from "../controllers/posts.controller.js";
import { protect } from "../middleware/auth.js";
import { imageUpload, multerErrorHandler } from "../middleware/upload.js";
import validate from "../middleware/validate.js";

const router = Router();

// IMPORTANT: literal-segment routes (`/explore`, `/feed`,
// `/user/:username`) MUST come before the parameterized `/:id` routes
// — otherwise Express matches the `/:id` route first and a request to
// `/api/posts/feed` falls into `getById` with id="feed", failing
// validation as "Invalid post id" instead of returning the user's
// feed.

// Public reads.
router.get("/explore", explore);
router.get("/user/:username", listByUsername);

// Authenticated reads.
router.get("/feed", protect, feed);

// Create: multipart upload, then validation. Validation runs *after*
// multer because zod parses `req.body` and multer is what populates
// caption/etc. for multipart requests.
router.post(
  "/",
  protect,
  imageUpload.single("image"),
  multerErrorHandler,
  validate(createPostSchema),
  create,
);

// Parameterized routes — registered last so the literal-segment routes
// above take precedence on the segments they own.
router.get("/:id", getById);
router.patch("/:id", protect, validate(updatePostSchema), update);
router.delete("/:id", protect, remove);

router.post("/:id/like", protect, like);
router.delete("/:id/like", protect, unlike);
router.post("/:id/save", protect, save);
router.delete("/:id/save", protect, unsave);

router.post("/:id/comments", protect, validate(createCommentSchema), addComment);
router.delete("/:id/comments/:commentId", protect, removeComment);

export default router;
