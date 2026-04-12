import mongoose from "mongoose";

const walletAdjustmentSchema = new mongoose.Schema(
  {
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
    },
    direction: {
      type: String,
      enum: ["credit", "debit"],
      default: "debit",
      index: true,
    },
    reasonCode: {
      type: String,
      enum: [
        "fraud_balance_clear",
        "task_submission_reward",
        "community_gift_send",
        "community_gift_claim",
        "internal_transfer_in",
      ],
      default: "fraud_balance_clear",
      index: true,
    },
    reasonLabel: {
      type: String,
      default: "Admin xoá số dư ví do nghi ngờ gian lận.",
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    effectiveAt: {
      type: Date,
      default: Date.now,
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

const WalletAdjustment = mongoose.model("WalletAdjustment", walletAdjustmentSchema);

export default WalletAdjustment;
