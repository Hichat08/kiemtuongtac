import mongoose from "mongoose";

const financeSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "default",
      trim: true,
      lowercase: true,
    },
    minDepositAmount: {
      type: Number,
      default: 50000,
      min: 0,
    },
    minWithdrawalAmount: {
      type: Number,
      default: 50000,
      min: 0,
    },
    depositBonusPercent: {
      type: Number,
      default: 10,
      min: 0,
      max: 100,
    },
    depositBonusEnabled: {
      type: Boolean,
      default: true,
    },
    withdrawalFeePercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    processingMode: {
      type: String,
      enum: ["instant", "standard", "manual"],
      default: "standard",
    },
  },
  {
    timestamps: true,
  }
);

const FinanceSettings = mongoose.model("FinanceSettings", financeSettingsSchema);

export default FinanceSettings;
