import mongoose from "mongoose";

const taskSubmissionSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SocialTask",
      required: true,
      index: true,
    },
    taskCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 32,
      index: true,
    },
    taskTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    taskBrand: {
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
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userAccountId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    userDisplayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    proofLink: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    screenshotUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    screenshotId: {
      type: String,
      trim: true,
      maxlength: 250,
      default: "",
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    reviewNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

taskSubmissionSchema.index({ taskId: 1, userId: 1, createdAt: -1 });
taskSubmissionSchema.index({ status: 1, submittedAt: -1 });

const TaskSubmission = mongoose.model("TaskSubmission", taskSubmissionSchema);

export default TaskSubmission;
