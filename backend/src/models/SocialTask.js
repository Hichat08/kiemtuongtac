import mongoose from "mongoose";

const socialTaskSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 32,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    brand: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    platform: {
      type: String,
      enum: ["facebook", "tiktok", "youtube", "other"],
      default: "other",
      index: true,
    },
    reward: {
      type: Number,
      required: true,
      min: 0,
    },
    current: {
      type: Number,
      default: 0,
      min: 0,
    },
    target: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["running", "pending", "completed", "paused"],
      default: "pending",
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 600,
      default: "",
    },
    actionLabel: {
      type: String,
      trim: true,
      maxlength: 60,
      default: "Nhận nhiệm vụ",
    },
    hot: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

socialTaskSchema.index({ platform: 1, status: 1 });

const SocialTask = mongoose.model("SocialTask", socialTaskSchema);

export default SocialTask;
