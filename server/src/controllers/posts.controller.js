import mongoose from "mongoose";
import { z } from "zod";

import env from "../config/env.js";
import Comment from "../models/Comment.js";
import Follow from "../models/Follow.js";
import Post from "../models/Post.js";
import User from "../models/User.js";
import { deletePostImage, uploadPostImage } from "../services/cloudinary.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

// --- Helpers -----------------------------------------------------------

// Centralize the populate shape so feed / explore / detail render the
// same fields. A bare `populate("author")` would leak the password
// hash via `select: false` defaults if the schema were ever changed,
// so we project explicitly.
function populatePost(query) {
  return query
    .populate("author", "username avatarUrl name")
    .populate({
      path: "comments",
      options: { sort: { createdAt: -1 }, limit: 20 },
      populate: { path: "author", select: "username avatarUrl" },
    });
}

function parseObjectIdParam(value, name) {
  if (!mongoose.isValidObjectId(value)) {
    throw new ApiError(400, `Invalid ${name}`);
  }
  return value;
}

const paginationSchema = z.object({
  // `coerce` accepts "12" from query strings; min/default keep clients
  // from asking for a 0-page or a huge fan-out.
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(env.POSTS_PAGE_MAX).optional().default(env.POSTS_PAGE_DEFAULT),
});

function parsePagination(query) {
  const result = paginationSchema.safeParse(query);
  if (!result.success) {
    const details = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "query";
      if (!(key in details)) details[key] = issue.message;
    }
    throw new ApiError(400, "Validation failed", { details });
  }
  return { ...result.data, skip: (result.data.page - 1) * result.data.limit };
}

// --- Schemas -----------------------------------------------------------

export const createPostSchema = z.object({
  caption: z.string().trim().max(2200).optional().default(""),
});

export const updatePostSchema = z
  .object({
    caption: z.string().trim().max(2200).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one updatable field is required",
  });

export const createCommentSchema = z.object({
  text: z.string().trim().min(1, "text is required").max(1000),
});

// --- Read handlers -----------------------------------------------------

export const explore = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const posts = await populatePost(
    Post.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
  );
  res.json({ posts, pagination: { page, limit } });
});

export const feed = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  // Followed user ids + the requester themselves; matches the
  // Instagram-style "your own posts plus the people you follow"
  // behavior. `lean()` because we only need the ids.
  const follows = await Follow.find({ follower: req.user._id })
    .select("following")
    .lean();
  const authorIds = [...follows.map((f) => f.following), req.user._id];

  const posts = await populatePost(
    Post.find({ author: { $in: authorIds } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
  );
  res.json({ posts, pagination: { page, limit } });
});

export const listByUsername = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const user = await User.findOne({ username: req.params.username.toLowerCase() })
    .select("_id")
    .lean();
  if (!user) throw new ApiError(404, "User not found");
  const posts = await populatePost(
    Post.find({ author: user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
  );
  res.json({ posts, pagination: { page, limit } });
});

export const getById = asyncHandler(async (req, res) => {
  parseObjectIdParam(req.params.id, "post id");
  const post = await populatePost(Post.findById(req.params.id));
  if (!post) throw new ApiError(404, "Post not found");
  res.json({ post });
});

// --- Write handlers ----------------------------------------------------

export const create = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "Image file is required");
  const { caption } = req.body;

  const { imageUrl, imagePublicId } = await uploadPostImage(
    req.file,
    req.user._id.toString(),
  );

  let post;
  try {
    post = await Post.create({
      author: req.user._id,
      imageUrl,
      imagePublicId,
      caption,
    });
  } catch (err) {
    // Compensating action: don't leave an orphan image behind if the
    // DB write fails. `deletePostImage` is best-effort and never
    // throws.
    await deletePostImage(imagePublicId);
    throw err;
  }

  const populated = await populatePost(Post.findById(post._id));
  res.status(201).json({ post: populated });
});

export const update = asyncHandler(async (req, res) => {
  parseObjectIdParam(req.params.id, "post id");
  const post = await Post.findById(req.params.id);
  if (!post) throw new ApiError(404, "Post not found");
  if (!post.author.equals(req.user._id)) {
    throw new ApiError(403, "You do not have permission to edit this post");
  }
  if ("caption" in req.body) post.caption = req.body.caption;
  await post.save();
  const populated = await populatePost(Post.findById(post._id));
  res.json({ post: populated });
});

export const remove = asyncHandler(async (req, res) => {
  parseObjectIdParam(req.params.id, "post id");
  const post = await Post.findById(req.params.id);
  if (!post) throw new ApiError(404, "Post not found");
  if (!post.author.equals(req.user._id)) {
    throw new ApiError(403, "You do not have permission to delete this post");
  }

  // Order matters: clear comments first so a partial failure doesn't
  // leave dangling comments referencing a deleted post id.
  await Comment.deleteMany({ post: post._id });
  await post.deleteOne();
  // Best-effort, see deletePostImage docstring.
  await deletePostImage(post.imagePublicId);
  res.json({ deleted: true });
});

// --- Likes / saves -----------------------------------------------------

export const like = asyncHandler(async (req, res) => {
  parseObjectIdParam(req.params.id, "post id");
  // `$addToSet` is idempotent: liking twice is a no-op rather than a 409.
  const post = await Post.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { likes: req.user._id } },
    { new: true },
  );
  if (!post) throw new ApiError(404, "Post not found");
  res.json({ liked: true, likesCount: post.likes.length });
});

export const unlike = asyncHandler(async (req, res) => {
  parseObjectIdParam(req.params.id, "post id");
  const post = await Post.findByIdAndUpdate(
    req.params.id,
    { $pull: { likes: req.user._id } },
    { new: true },
  );
  if (!post) throw new ApiError(404, "Post not found");
  res.json({ liked: false, likesCount: post.likes.length });
});

export const save = asyncHandler(async (req, res) => {
  parseObjectIdParam(req.params.id, "post id");
  const post = await Post.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { savedBy: req.user._id } },
    { new: true },
  );
  if (!post) throw new ApiError(404, "Post not found");
  res.json({ saved: true });
});

export const unsave = asyncHandler(async (req, res) => {
  parseObjectIdParam(req.params.id, "post id");
  const post = await Post.findByIdAndUpdate(
    req.params.id,
    { $pull: { savedBy: req.user._id } },
    { new: true },
  );
  if (!post) throw new ApiError(404, "Post not found");
  res.json({ saved: false });
});

// --- Comments ----------------------------------------------------------

export const addComment = asyncHandler(async (req, res) => {
  parseObjectIdParam(req.params.id, "post id");
  const post = await Post.findById(req.params.id).select("_id");
  if (!post) throw new ApiError(404, "Post not found");

  const comment = await Comment.create({
    post: post._id,
    author: req.user._id,
    text: req.body.text,
  });

  // Keep Post.comments in sync so the populate-by-virtual on detail
  // returns the new comment without a separate query.
  await Post.updateOne({ _id: post._id }, { $push: { comments: comment._id } });

  await comment.populate("author", "username avatarUrl");
  res.status(201).json({ comment });
});

export const removeComment = asyncHandler(async (req, res) => {
  parseObjectIdParam(req.params.id, "post id");
  parseObjectIdParam(req.params.commentId, "comment id");

  const comment = await Comment.findOne({
    _id: req.params.commentId,
    post: req.params.id,
  });
  if (!comment) throw new ApiError(404, "Comment not found");
  if (!comment.author.equals(req.user._id)) {
    throw new ApiError(403, "You do not have permission to delete this comment");
  }

  await comment.deleteOne();
  await Post.updateOne({ _id: comment.post }, { $pull: { comments: comment._id } });
  res.json({ deleted: true });
});
