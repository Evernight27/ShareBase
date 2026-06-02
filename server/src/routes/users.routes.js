import { Router } from "express";

import {
  follow,
  getByUsername,
  search,
  unfollow,
  updateMe,
  updateProfileSchema,
} from "../controllers/users.controller.js";
import { protect, softAuth } from "../middleware/auth.js";
import validate from "../middleware/validate.js";

const router = Router();

// Specific routes before the catch-all `/:username` so "search" and
// "me" don't get matched as a username.
router.get("/search", search);
router.patch("/me", protect, validate(updateProfileSchema), updateMe);

router.post("/:id/follow", protect, follow);
router.delete("/:id/follow", protect, unfollow);

// Public profile lookup, with softAuth so an authenticated viewer
// gets `viewerIsFollowing` populated and the client can render a
// follow/unfollow button without a second request.
router.get("/:username", softAuth, getByUsername);

export default router;
