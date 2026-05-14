import { z } from "zod";

import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { signToken } from "../utils/jwt.js";

// --- Schemas -----------------------------------------------------------

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._]{3,30}$/, "username must be 3-30 chars (a-z, 0-9, '.', '_')");

const emailSchema = z.string().trim().toLowerCase().email("email is invalid");

// Password policy is intentionally simple: min 8 chars. We don't enforce
// character classes — research consistently finds length matters more.
const passwordSchema = z.string().min(8, "password must be at least 8 characters").max(200);

export const signupSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().max(50).optional().default(""),
});

export const loginSchema = z.object({
  // Accept either an email or a username under one field so the UI can
  // have a single "Email or username" input like Instagram does.
  identifier: z.string().trim().min(1, "identifier is required"),
  password: z.string().min(1, "password is required"),
});

// --- Helpers -----------------------------------------------------------

function authResponse(user) {
  const token = signToken(user._id);
  // toJSON() runs the schema transform that strips `password`.
  return { token, user: user.toJSON() };
}

// --- Handlers ----------------------------------------------------------

export const signup = asyncHandler(async (req, res) => {
  const { username, email, password, name } = req.body;

  // Pre-check duplicates so we can return a friendly per-field message
  // rather than the generic Mongoose duplicate-key envelope.
  const conflict = await User.findOne({ $or: [{ username }, { email }] })
    .select("username email")
    .lean();
  if (conflict) {
    const details = {};
    if (conflict.username === username) details.username = "username already taken";
    if (conflict.email === email) details.email = "email already registered";
    throw new ApiError(409, "Account already exists", { details });
  }

  const user = await User.create({ username, email, password, name });
  res.status(201).json(authResponse(user));
});

export const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;

  // Normalize before querying so 'Alice@Example.com' matches the stored
  // lowercased email.
  const needle = identifier.toLowerCase();
  const user = await User.findOne({
    $or: [{ email: needle }, { username: needle }],
  }).select("+password");

  // Same error for "no such user" and "wrong password" so the endpoint
  // doesn't double as a user-existence oracle.
  const ok = user ? await user.comparePassword(password) : false;
  if (!ok) {
    throw new ApiError(401, "Invalid credentials");
  }

  res.json(authResponse(user));
});

export const me = asyncHandler(async (req, res) => {
  // `protect` already loaded the user and password is select:false, so
  // toJSON()'s transform doesn't have anything to strip — but the
  // transform is the single source of truth either way.
  res.json({ user: req.user.toJSON() });
});
