import crypto from "crypto";
import mongoose from "mongoose";

const createRandomAccountId = () =>
  crypto.randomInt(0, 100_000_000).toString().padStart(8, "0");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    accountId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      match: [/^\d{8}$/, "ID tài khoản phải gồm đúng 8 chữ số."],
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
      index: true,
    },
    hashedPassword: {
      type: String,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    avatarUrl: {
      type: String, // link CDN để hiển thị hình
    },
    avatarId: {
      type: String, // Cloudinary public_id để xoá hình
    },
    bio: {
      type: String,
      maxlength: 500, // tuỳ
    },
    phone: {
      type: String,
      sparse: true, // cho phép null, nhưng không được trùng
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    authProviders: {
      type: [String],
      default: ["local"],
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    referralCodeUsed: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 80,
      default: "",
    },
    notificationPreferences: {
      activity: {
        newTasks: {
          type: Boolean,
          default: true,
        },
        reviewStatus: {
          type: Boolean,
          default: true,
        },
        balanceChanges: {
          type: Boolean,
          default: true,
        },
      },
      system: {
        adminMessages: {
          type: Boolean,
          default: true,
        },
        promotions: {
          type: Boolean,
          default: false,
        },
      },
      emailDigest: {
        type: Boolean,
        default: false,
      },
      pushEnabled: {
        type: Boolean,
        default: false,
      },
    },
    lastLoginAt: {
      type: Date,
    },
    lastLoginIp: {
      type: String,
    },
    lastLoginUserAgent: {
      type: String,
    },
    moderationStatus: {
      type: String,
      enum: ["active", "warned", "locked"],
      default: "active",
      index: true,
    },
    restoreModerationStatus: {
      type: String,
      enum: ["active", "warned"],
      default: "active",
    },
    warningCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    moderationNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    lastWarnedAt: {
      type: Date,
      default: null,
    },
    lockedAt: {
      type: Date,
      default: null,
    },
    communityChatStatus: {
      type: String,
      enum: ["active", "locked"],
      default: "active",
      index: true,
    },
    communityChatModerationNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    communityChatLockedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.statics.generateUniqueAccountId = async function generateUniqueAccountId() {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = createRandomAccountId();
    const exists = await this.exists({ accountId: candidate });

    if (!exists) {
      return candidate;
    }
  }

  throw new Error("Không thể tạo ID tài khoản 8 số duy nhất.");
};

userSchema.methods.ensureAccountId = async function ensureAccountId() {
  if (this.accountId) {
    return this.accountId;
  }

  this.accountId = await this.constructor.generateUniqueAccountId();
  return this.accountId;
};

userSchema.pre("validate", async function assignAccountId(next) {
  try {
    if (!this.accountId) {
      await this.ensureAccountId();
    }

    next();
  } catch (error) {
    next(error);
  }
});

const User = mongoose.model("User", userSchema);
export default User;
