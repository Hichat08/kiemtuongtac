import mongoose from "mongoose";

const communityGiftClaimSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    claimedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const communityGiftSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      required: true,
      unique: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    senderAccountId: {
      type: String,
      required: true,
      trim: true,
    },
    senderDisplayName: {
      type: String,
      required: true,
      trim: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 1,
    },
    remainingAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    recipientLimit: {
      type: Number,
      required: true,
      min: 1,
      max: 999,
    },
    remainingSlots: {
      type: Number,
      required: true,
      min: 0,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 60,
      default: "",
    },
    note: {
      type: String,
      trim: true,
      maxlength: 50,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "exhausted"],
      default: "active",
      index: true,
    },
    claims: {
      type: [communityGiftClaimSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

communityGiftSchema.index({ conversationId: 1, createdAt: -1 });

const CommunityGift = mongoose.model("CommunityGift", communityGiftSchema);

export default CommunityGift;
