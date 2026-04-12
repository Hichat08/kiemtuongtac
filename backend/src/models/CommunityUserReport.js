import mongoose from "mongoose";

const communityUserReportSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reporterAccountId: {
      type: String,
      trim: true,
      default: "",
    },
    reporterDisplayName: {
      type: String,
      trim: true,
      required: true,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetAccountId: {
      type: String,
      trim: true,
      default: "",
    },
    targetDisplayName: {
      type: String,
      trim: true,
      required: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    conversationLabel: {
      type: String,
      trim: true,
      default: "",
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
      index: true,
    },
    latestMessageExcerpt: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },
    category: {
      type: String,
      enum: ["spam", "scam", "harassment", "impersonation", "abuse", "other"],
      required: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "in_review", "resolved", "dismissed"],
      default: "pending",
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

communityUserReportSchema.index({ status: 1, createdAt: -1 });
communityUserReportSchema.index({
  reporterId: 1,
  targetUserId: 1,
  conversationId: 1,
  status: 1,
});

const CommunityUserReport = mongoose.model(
  "CommunityUserReport",
  communityUserReportSchema
);

export default CommunityUserReport;
