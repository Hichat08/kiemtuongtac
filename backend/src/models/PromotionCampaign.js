import mongoose from "mongoose";

const promotionCampaignSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    category: {
      type: String,
      enum: ["event", "promotion"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "running", "paused", "completed"],
      default: "draft",
      index: true,
    },
    audience: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    benefit: {
      type: String,
      required: true,
      trim: true,
      maxlength: 220,
    },
    summary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 600,
    },
    startAt: {
      type: Date,
      default: null,
    },
    endAt: {
      type: Date,
      default: null,
    },
    highlighted: {
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

promotionCampaignSchema.index({ category: 1, status: 1 });

const PromotionCampaign = mongoose.model("PromotionCampaign", promotionCampaignSchema);

export default PromotionCampaign;
