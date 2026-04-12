import mongoose from "mongoose";

const bankAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    bankName: {
      type: String,
      required: true,
      trim: true,
    },
    bankCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    accountHolder: {
      type: String,
      required: true,
      trim: true,
    },
    branch: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "verified", "locked"],
      default: "pending",
      index: true,
    },
    restoreStatus: {
      type: String,
      enum: ["pending", "verified"],
      default: "pending",
    },
    primary: {
      type: Boolean,
      default: false,
    },
    linkedPhone: {
      type: String,
      trim: true,
      default: "",
    },
    identityNumber: {
      type: String,
      trim: true,
      default: "",
    },
    swiftCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    province: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    verificationNote: {
      type: String,
      trim: true,
      default: "Yêu cầu xác minh đang chờ admin xử lý.",
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const BankAccount = mongoose.model("BankAccount", bankAccountSchema);

export default BankAccount;
