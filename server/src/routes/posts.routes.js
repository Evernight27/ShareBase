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

// Public reads — explore + single post + posts-by-username — don't need
// auth so an unauthenticated visitor can browse.
router.get("/explore", explore);
router.get("/user/:username", listByUsername);
router.get("/:id", getById);

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

router.patch("/:id", protect, validate(updatePostSchema), update);
router.delete("/:id", protect, remove);

router.post("/:id/like", protect, like);
router.delete("/:id/like", protect, unlike);
router.post("/:id/save", protect, save);
router.delete("/:id/save", protect, unsave);

router.post("/:id/comments", protect, validate(createCommentSchema), addComment);
router.delete("/:id/comments/:commentId", protect, removeComment);

export default router;
