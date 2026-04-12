import mongoose from "mongoose";

const adminBroadcastNotificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1200,
    },
    type: {
      type: String,
      enum: ["system", "promotion", "warning", "task"],
      default: "system",
      index: true,
    },
    audience: {
      type: String,
      enum: ["all", "verified", "new_7d"],
      default: "all",
      index: true,
    },
    status: {
      type: String,
      enum: ["sent", "scheduled"],
      default: "sent",
      index: true,
    },
    imageUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    recipientCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    scheduledAt: {
      type: Date,
      default: null,
      index: true,
    },
    sentAt: {
      type: Date,
      default: null,
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

adminBroadcastNotificationSchema.index({ status: 1, scheduledAt: 1 });
adminBroadcastNotificationSchema.index({ audience: 1, sentAt: -1, createdAt: -1 });

const AdminBroadcastNotification = mongoose.model(
  "AdminBroadcastNotification",
  adminBroadcastNotificationSchema
);

export default AdminBroadcastNotification;
