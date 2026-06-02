import { Router } from "express";

import {
  follow,
  getByUsername,
  search,
  unfollow,
  updateMe,
  updateProfileSchema,
} from "../controllers/users.controller.js";
import { protect } from "../middleware/auth.js";
import validate from "../middleware/validate.js";

const router = Router();

// Specific routes before the catch-all `/:username` so "search" and
// "me" don't get matched as a username.
router.get("/search", search);
router.patch("/me", protect, validate(updateProfileSchema), updateMe);

router.post("/:id/follow", protect, follow);
router.delete("/:id/follow", protect, unfollow);

router.get("/:username", getByUsername);

export default router;
