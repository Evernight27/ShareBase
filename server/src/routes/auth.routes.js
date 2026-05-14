import { Router } from "express";
import rateLimit from "express-rate-limit";

import { isTest } from "../config/env.js";
import { login, loginSchema, me, signup, signupSchema } from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.js";
import validate from "../middleware/validate.js";

const router = Router();

// Per-IP rate limit on the credential-touching endpoints. Tight enough
// to slow brute force, loose enough that a frustrated real user
// retrying after a typo isn't locked out. Disabled in test so the
// suite doesn't trip on its own throughput.
const credentialsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 0 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: { message: "Too many attempts, please try again later" } },
});

router.post("/signup", credentialsLimiter, validate(signupSchema), signup);
router.post("/login", credentialsLimiter, validate(loginSchema), login);
router.get("/me", protect, me);

export default router;
