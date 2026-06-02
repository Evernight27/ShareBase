import mongoose from "mongoose";

// One document per (follower → following) edge. This scales past the
// ~16 MB document limit that an embedded `followers`/`following` array
// on User would eventually hit, and lets the follow graph be queried
// efficiently with the indexes below.
//
// The Follow collection is the single source of truth for the follow
// graph; the User schema does not carry embedded follower/following
// arrays. Profile stats derive from `Follow.countDocuments(...)`.
const followSchema = new mongoose.Schema(
  {
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
  },
);

// The compound unique index is the source of truth for "user A follows
// user B". `{ unique: true }` on a compound index already creates the
// index, so we don't add separate `index: true` on each path — that
// would build redundant single-field indexes and Mongoose 9 warns.
followSchema.index({ follower: 1, following: 1 }, { unique: true });

// Hot path: "list everyone B is followed by" / "list everyone A
// follows" / "count of followers/following". Mongo can use the
// compound index above for `{ follower: ... }` queries (left-most
// prefix), so we only need one extra index on `following` for the
// reverse direction.
followSchema.index({ following: 1 });

const Follow = mongoose.models.Follow || mongoose.model("Follow", followSchema);

export default Follow;
