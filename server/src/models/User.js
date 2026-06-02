import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Exported so request-validation schemas can reuse the same regex
// without drift between Mongoose `match` and Zod `regex` rules.
export const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;
export const USERNAME_MESSAGE = "username must be 3-30 chars (a-z, 0-9, '.', '_')";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 10;

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "username is required"],
      lowercase: true,
      trim: true,
      // `unique: true` already creates a unique index, so we don't add
      // `index: true` on top — that would build a redundant non-unique
      // index and Mongoose 9 warns about it at startup.
      unique: true,
      match: [USERNAME_PATTERN, USERNAME_MESSAGE],
    },
    email: {
      type: String,
      required: [true, "email is required"],
      lowercase: true,
      trim: true,
      unique: true,
      match: [EMAIL_PATTERN, "email is invalid"],
    },
    // Hashed; never returned to clients. `select: false` keeps it out of
    // default query projections — handlers that need it (login) opt in
    // explicitly with `.select('+password')`.
    password: {
      type: String,
      required: [true, "password is required"],
      select: false,
    },
    name: { type: String, trim: true, default: "", maxlength: 50 },
    bio: { type: String, trim: true, default: "", maxlength: 200 },
    avatarUrl: { type: String, default: "" },
    // The follow graph is stored in the Follow collection, not here, so
    // it scales past the 16 MB document limit. The previous embedded
    // followers/following arrays were unused dead state and have been
    // removed.
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret) => {
        // Two privacy-sensitive fields. `password` is `select:false` so
        // it usually isn't loaded, but the transform is the
        // single-source-of-truth and the cheapest insurance against a
        // future query that pulls it explicitly. `email` is treated as
        // private-by-default — the public profile (`GET /api/users/...`)
        // and populated `author` payloads on posts must not leak it to
        // anonymous visitors. Endpoints that legitimately need to
        // return the requester's own email use `toPrivateJSON()`
        // explicitly.
        delete ret.password;
        delete ret.email;
        return ret;
      },
    },
  },
);

// Mongoose 9: an async pre-hook signals success by resolving and
// failure by rejecting. The legacy `next` callback is NOT passed —
// using it produces 'next is not a function'.
userSchema.pre("save", async function hashPasswordOnChange() {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.password);
};

/**
 * Same as `toJSON()` but additionally includes the requester's own
 * email. Use only on responses where the caller IS the user being
 * serialized — `/api/auth/{signup,login,me}` and the `PATCH
 * /api/users/me` confirmation. Everywhere else (public profile, search
 * results, populated authors) must call `toJSON()` so email doesn't
 * leak.
 */
userSchema.methods.toPrivateJSON = function toPrivateJSON() {
  const json = this.toJSON();
  json.email = this.email;
  return json;
};

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
