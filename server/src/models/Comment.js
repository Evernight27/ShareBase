import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: [true, "text is required"],
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
  },
);

const Comment = mongoose.models.Comment || mongoose.model("Comment", commentSchema);

export default Comment;
