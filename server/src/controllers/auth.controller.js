import bcrypt from "bcryptjs";
import { z } from "zod";

import User, {
  USERNAME_PATTERN,
  USERNAME_MESSAGE,
  RESERVED_USERNAMES,
  RESERVED_USERNAME_MESSAGE,
} from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { signToken } from "../utils/jwt.js";

// --- Schemas -----------------------------------------------------------

// Reuse the regex + message that the Mongoose model enforces so the two
// validators can't drift.
const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, USERNAME_MESSAGE)
  // Reject names that would shadow router segments (`/search`,
  // `/explore`, `/api`, etc.). Same set is enforced at the model
  // layer in case a future tool writes directly to the DB.
  .refine((v) => !RESERVED_USERNAMES.has(v), { message: RESERVED_USERNAME_MESSAGE });

const emailSchema = z.string().trim().toLowerCase().email("email is invalid");

// Password policy is intentionally simple: min 8 chars. We don't enforce
// character classes — research consistently finds length matters more.
const passwordSchema = z.string().min(8, "password must be at least 8 characters").max(200);

// A bcrypt hash we run a doomed compare against when login can't find
// the user. Equalizes response time with the "user exists, wrong
// password" path so an attacker can't enumerate accounts via timing.
// Hash of an unguessable random string at the same cost factor as the
// real hashes; the plaintext is gone and we never check what it was.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-never-matches", 10);

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
  // toPrivateJSON includes the requester's own email; the schema
  // transform always strips password.
  return { token, user: user.toPrivateJSON() };
}

// --- Handlers ----------------------------------------------------------

// Translate a Mongoose duplicate-key error into our per-field signup
// envelope. Used by signup as a fallback so the race-window UX matches
// the pre-checked UX.
function duplicateKeyToApiError(err) {
  const details = {};
  for (const field of Object.keys(err.keyValue || {})) {
    if (field === "username") details.username = "username already taken";
    else if (field === "email") details.email = "email already registered";
    else details[field] = `${field} already in use`;
  }
  return new ApiError(409, "Account already exists", { details });
}

export const signup = asyncHandler(async (req, res) => {
  const { username, email, password, name } = req.body;

  // Pre-check duplicates so the common case returns a friendly per-field
  // message rather than the generic Mongoose duplicate-key envelope.
  const conflict = await User.findOne({ $or: [{ username }, { email }] })
    .select("username email")
    .lean();
  if (conflict) {
    const details = {};
    if (conflict.username === username) details.username = "username already taken";
    if (conflict.email === email) details.email = "email already registered";
    throw new ApiError(409, "Account already exists", { details });
  }

  try {
    const user = await User.create({ username, email, password, name });
    res.status(201).json(authResponse(user));
  } catch (err) {
    // A concurrent signup can slip between the pre-check and the
    // create; the unique index then raises 11000. Map it to the same
    // per-field envelope the pre-check would have produced.
    if (err && err.code === 11000) throw duplicateKeyToApiError(err);
    throw err;
  }
});

export const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;

  // Normalize before querying so 'Alice@Example.com' matches the stored
  // lowercased email.
  const needle = identifier.toLowerCase();
  const user = await User.findOne({
    $or: [{ email: needle }, { username: needle }],
  }).select("+password");

  // Run bcrypt.compare unconditionally — against a dummy hash when the
  // user is missing — so the response time can't be used to enumerate
  // accounts. The actual auth decision still gates on `user` existing.
  const candidateHash = user?.password ?? DUMMY_HASH;
  const matched = await bcrypt.compare(password, candidateHash);
  if (!user || !matched) {
    throw new ApiError(401, "Invalid credentials");
  }

  res.json(authResponse(user));
});

export const me = asyncHandler(async (req, res) => {
  // `/me` returns the requester's own user, so it gets the
  // private serialization that includes email. `protect` already
  // loaded the user; password is `select:false` so the schema
  // transform has nothing to strip on the typical path.
  res.json({ user: req.user.toPrivateJSON() });
});
