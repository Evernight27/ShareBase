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
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret) => {
        // Defensive: in case a query accidentally pulled `password`, it
        // must never appear in a JSON response.
        delete ret.password;
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

// Convenience: clean projection for "the public shape of a user".
userSchema.statics.publicFields = "username email name bio avatarUrl followers following createdAt";

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
