import mongoose from "mongoose";
import { z } from "zod";

import Follow from "../models/Follow.js";
import Post from "../models/Post.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

// --- Schemas -----------------------------------------------------------

// Allow editing of self-describing profile fields. Username/email
// changes are deliberately out of scope for now — they have invariants
// (uniqueness, casing, downstream auth) that warrant their own
// dedicated endpoints.
export const updateProfileSchema = z
  .object({
    name: z.string().trim().max(50).optional(),
    bio: z.string().trim().max(200).optional(),
    avatarUrl: z.string().trim().url("avatarUrl must be a valid URL").max(500).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one updatable field is required",
  });

// --- Helpers -----------------------------------------------------------

/**
 * Build the profile envelope returned by the public `GET /:username`
 * lookup and the private `PATCH /me` confirmation.
 *
 * `serialize` selects between the safe (public) shape — `toJSON()`,
 * which strips `password` AND `email` — and the private shape —
 * `toPrivateJSON()`, which includes the requester's own email.
 *
 * `viewerId` (when present) adds a `viewerIsFollowing` boolean so the
 * client can render a follow/unfollow button without a second
 * round-trip. Always `false` for self-views (you can't follow
 * yourself, and the field would be misleading otherwise).
 *
 * Stats always come from the Follow + Post collections; the model has
 * no embedded follow arrays.
 */
async function buildProfileResponse(user, { serialize = "public", viewerId = null } = {}) {
  const isSelf = viewerId ? user._id.equals(viewerId) : false;

  const baseQueries = [
    Post.countDocuments({ author: user._id }),
    Follow.countDocuments({ following: user._id }),
    Follow.countDocuments({ follower: user._id }),
  ];
  const followingCheck =
    viewerId && !isSelf
      ? Follow.exists({ follower: viewerId, following: user._id })
      : Promise.resolve(null);

  const [postsCount, followersCount, followingCount, followingDoc] = await Promise.all([
    ...baseQueries,
    followingCheck,
  ]);

  const base = serialize === "private" ? user.toPrivateJSON() : user.toJSON();
  const result = {
    ...base,
    stats: {
      posts: postsCount,
      followers: followersCount,
      following: followingCount,
    },
  };

  if (viewerId) {
    // Self never has a follow relationship to themselves.
    result.viewerIsFollowing = !isSelf && Boolean(followingDoc);
    result.isSelf = isSelf;
  }

  return result;
}

function parseObjectIdParam(value, name) {
  if (!mongoose.isValidObjectId(value)) {
    throw new ApiError(400, `Invalid ${name}`);
  }
  return value;
}

// --- Handlers ----------------------------------------------------------

// Search by username prefix — anchors the regex with `^` so the index
// on `username` can be used. Caller-supplied input goes through a
// strict regex-escape so a query like `.*` doesn't turn into a full
// scan or worse.
//
// Result shape is the public projection (no email, no password) plus
// `name` and `avatarUrl` so a search dropdown can render an avatar +
// display name without a follow-up profile fetch.
export const search = asyncHandler(async (req, res) => {
  const raw = String(req.query.q || "").trim().toLowerCase();
  if (!raw) {
    res.json({ users: [] });
    return;
  }
  const safe = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const users = await User.find({ username: { $regex: `^${safe}` } })
    .select("username name avatarUrl bio")
    .sort({ username: 1 })
    .limit(10);
  // The explicit projection above already excludes email/password, but
  // we still go through `toJSON()` to keep the response shape (stripped
  // versionKey, etc.) consistent with the rest of the API.
  res.json({ users: users.map((u) => u.toJSON()) });
});

export const getByUsername = asyncHandler(async (req, res) => {
  const user = await User.findOne({ username: req.params.username.toLowerCase() });
  if (!user) throw new ApiError(404, "User not found");
  res.json({
    user: await buildProfileResponse(user, {
      serialize: "public",
      viewerId: req.user?._id ?? null,
    }),
  });
});

export const updateMe = asyncHandler(async (req, res) => {
  const allowed = ["name", "bio", "avatarUrl"];
  for (const field of allowed) {
    if (field in req.body) req.user[field] = req.body[field];
  }
  await req.user.save();
  // Own profile — return the private serialization including email.
  res.json({
    user: await buildProfileResponse(req.user, {
      serialize: "private",
      viewerId: req.user._id,
    }),
  });
});

export const follow = asyncHandler(async (req, res) => {
  parseObjectIdParam(req.params.id, "user id");
  if (req.params.id === req.user._id.toString()) {
    throw new ApiError(400, "You cannot follow yourself");
  }
  const target = await User.findById(req.params.id).select("_id");
  if (!target) throw new ApiError(404, "User not found");

  // `upsert` makes "follow" idempotent — re-following is a no-op
  // rather than surfacing the duplicate-key error that the unique
  // index would otherwise raise.
  await Follow.updateOne(
    { follower: req.user._id, following: target._id },
    { $setOnInsert: { follower: req.user._id, following: target._id } },
    { upsert: true },
  );
  res.json({ following: true });
});

export const unfollow = asyncHandler(async (req, res) => {
  parseObjectIdParam(req.params.id, "user id");
  await Follow.deleteOne({ follower: req.user._id, following: req.params.id });
  res.json({ following: false });
});
