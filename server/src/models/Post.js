import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    imageUrl: { type: String, required: true },
    // Cloudinary public_id; nullable so the local-disk fallback used in
    // dev (Phase 3) can leave it empty.
    imagePublicId: { type: String, default: "" },
    caption: { type: String, default: "", maxlength: 2200, trim: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }],
    // Users who bookmarked this post. Distinct from `likes` (a like is a
    // public reaction; a save is a private "remember this for later").
    // The schema transform below STRIPS this from JSON output —
    // returning it would tell anyone who looks at a post which other
    // users have privately bookmarked it. The posts controller
    // surfaces a `viewerHasSaved: boolean` derived field for the
    // requester instead.
    savedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret) => {
        delete ret.savedBy;
        return ret;
      },
    },
  },
);

// Feed queries page newest-first on createdAt; this is the hot path.
postSchema.index({ createdAt: -1 });

const Post = mongoose.models.Post || mongoose.model("Post", postSchema);

export default Post;
