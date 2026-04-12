import Conversation from "../models/Conversation.js";
import CommunityGift from "../models/CommunityGift.js";
import CommunityUserReport from "../models/CommunityUserReport.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import WalletAdjustment from "../models/WalletAdjustment.js";
import {
  emitCommunityGiftUpdated,
  emitNewMessage,
  formatMessagePayload,
  updateConversationAfterCreateMessage,
} from "../utils/messageHelper.js";
import {
  resolveCommunityGiftClaimAmount,
  serializeCommunityGift,
} from "../utils/communityGiftHelper.js";
import {
  buildFinancialSummary,
  getUserFinancialRecords,
} from "../utils/financialRequestHelper.js";
import { queueWalletAdjustmentEmail } from "../services/userNotificationService.js";
import { io } from "../socket/index.js";

const COMMUNITY_GIFT_MESSAGE_PREVIEW = "[Quà cộng đồng]";
const GLOBAL_COMMUNITY_KEY = "global-community";
const SUPPORT_CONVERSATION_KEY_PREFIX = "support-room:";
const COMMUNITY_REPORT_CATEGORIES = new Set([
  "spam",
  "scam",
  "harassment",
  "impersonation",
  "abuse",
  "other",
]);

const isCommunityChatLocked = (user) =>
  user?.role !== "admin" && user?.communityChatStatus === "locked";

const buildCommunityChatLockedResponse = (user) => ({
  message:
    `${user?.communityChatModerationNote ?? ""}`.trim() ||
    "Bạn đang bị khóa chat cộng đồng. Vui lòng liên hệ admin nếu cần hỗ trợ.",
  communityChatLocked: true,
  note: `${user?.communityChatModerationNote ?? ""}`.trim(),
  lockedAt: user?.communityChatLockedAt ?? null,
});

const isSupportConversation = (conversation) =>
  `${conversation?.systemKey ?? ""}`.startsWith(SUPPORT_CONVERSATION_KEY_PREFIX);

const normalizeCommunityGiftPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const amount = Math.round(Number(payload.amount ?? 0));
  const recipientCount = Math.round(Number(payload.recipientCount ?? 0));
  const title = `${payload.title ?? ""}`.trim().slice(0, 60);
  const note = `${payload.message ?? payload.note ?? ""}`.trim().slice(0, 50);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  if (!Number.isFinite(recipientCount) || recipientCount <= 0 || recipientCount > 999) {
    return null;
  }

  return {
    amount,
    recipientCount,
    title,
    note,
  };
};

const normalizeCommunityUserReportPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const targetUserId = `${payload.targetUserId ?? ""}`.trim();
  const conversationId = `${payload.conversationId ?? ""}`.trim();
  const messageId = `${payload.messageId ?? ""}`.trim();
  const category = `${payload.category ?? ""}`.trim();
  const description = `${payload.description ?? ""}`.trim().slice(0, 500);

  if (!targetUserId || !conversationId || !COMMUNITY_REPORT_CATEGORIES.has(category)) {
    return null;
  }

  if (category === "other" && !description) {
    return null;
  }

  return {
    targetUserId,
    conversationId,
    messageId: messageId || null,
    category,
    description,
  };
};

const getConversationLabel = (conversation) =>
  `${conversation?.group?.name ?? ""}`.trim() || "Cộng đồng";

const getReportMessageExcerpt = (message) => {
  const giftTitle = `${message?.communityGiftId?.title ?? ""}`.trim();
  const giftNote = `${message?.communityGiftId?.note ?? ""}`.trim();
  const content = `${message?.content ?? ""}`.trim();

  return (giftNote || giftTitle || content || "Không có nội dung.").slice(0, 240);
};

const canAccessConversation = (conversation, userId) =>
  conversation?.systemKey === "global-community" ||
  (conversation?.participants ?? []).some(
    (participant) => participant.userId?.toString() === userId.toString()
  );

const populateMessageWithGift = async (messageId) =>
  Message.findById(messageId)
    .populate({
      path: "senderId",
      select: "displayName avatarUrl",
    })
    .populate({
      path: "communityGiftId",
      populate: {
        path: "claims.userId",
        select: "displayName avatarUrl",
      },
    });

export const sendDirectMessage = async (req, res) => {
  try {
    const { recipientId, content, conversationId } = req.body;
    const senderId = req.user._id;

    let conversation;

    if (!content) {
      return res.status(400).json({ message: "Thiếu nội dung" });
    }

    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
    }

    if (!conversation) {
      conversation = await Conversation.create({
        type: "direct",
        participants: [
          { userId: senderId, joinedAt: new Date() },
          { userId: recipientId, joinedAt: new Date() },
        ],
        lastMessageAt: new Date(),
        unreadCounts: new Map(),
      });
    }

    const message = await Message.create({
      conversationId: conversation._id,
      senderId,
      content,
    });

    updateConversationAfterCreateMessage(conversation, message, senderId);

    await conversation.save();
    const populatedMessage = await Message.findById(message._id).populate({
      path: "senderId",
      select: "displayName avatarUrl",
    });

    emitNewMessage(io, conversation, populatedMessage);

    return res.status(201).json({ message: formatMessagePayload(populatedMessage) });
  } catch (error) {
    console.error("Lỗi xảy ra khi gửi tin nhắn trực tiếp", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const sendGroupMessage = async (req, res) => {
  let createdMessage = null;
  let createdGift = null;
  let createdAdjustment = null;
  let committed = false;

  try {
    const { conversationId, content, communityGift } = req.body;
    const senderId = req.user._id;
    const conversation = req.conversation;
    const normalizedGift = normalizeCommunityGiftPayload(communityGift);
    const safeContent = `${content ?? ""}`.trim();

    if (req.user?.role !== "admin" && req.user?.moderationStatus === "locked") {
      if (!isSupportConversation(conversation)) {
        return res.status(403).json({
          message: "Tài khoản bị khóa chỉ có thể nhắn tin trong phòng hỗ trợ.",
        });
      }
    }

    if (conversation.systemKey === GLOBAL_COMMUNITY_KEY && isCommunityChatLocked(req.user)) {
      return res.status(423).json(buildCommunityChatLockedResponse(req.user));
    }

    if (communityGift && !normalizedGift) {
      return res.status(400).json({ message: "Thông tin quà cộng đồng không hợp lệ." });
    }

    if (!safeContent && !normalizedGift) {
      return res.status(400).json({ message: "Thiếu nội dung" });
    }

    if (normalizedGift) {
      if (normalizedGift.amount < normalizedGift.recipientCount) {
        return res.status(400).json({
          message: "Tổng số tiền phải lớn hơn hoặc bằng số người nhận.",
        });
      }

      const senderRecords = await getUserFinancialRecords(senderId);
      const senderSummary = buildFinancialSummary(senderRecords);

      if (senderSummary.currentBalance < normalizedGift.amount) {
        return res.status(400).json({ message: "Số dư ví hiện tại không đủ để gửi quà." });
      }

      createdAdjustment = await WalletAdjustment.create({
        userId: req.user._id,
        userAccountId: req.user.accountId,
        userDisplayName: req.user.displayName,
        direction: "debit",
        reasonCode: "community_gift_send",
        reasonLabel: "Gửi quà cộng đồng trong phòng chat.",
        amount: normalizedGift.amount,
        note:
          normalizedGift.note ||
          `Gửi quà cộng đồng cho ${normalizedGift.recipientCount} người nhận.`,
      });
    }

    createdMessage = await Message.create({
      conversationId,
      senderId,
      content: normalizedGift ? COMMUNITY_GIFT_MESSAGE_PREVIEW : safeContent,
      type: normalizedGift ? "community_gift" : "text",
    });

    if (normalizedGift) {
      createdGift = await CommunityGift.create({
        conversationId,
        messageId: createdMessage._id,
        senderId: req.user._id,
        senderAccountId: req.user.accountId,
        senderDisplayName: req.user.displayName,
        totalAmount: normalizedGift.amount,
        remainingAmount: normalizedGift.amount,
        recipientLimit: normalizedGift.recipientCount,
        remainingSlots: normalizedGift.recipientCount,
        title: normalizedGift.title,
        note: normalizedGift.note,
      });

      createdMessage.communityGiftId = createdGift._id;
      await createdMessage.save();
    }

    let unreadMemberIds = null;

    if (conversation.systemKey === GLOBAL_COMMUNITY_KEY) {
      const users = await User.find({}, { _id: 1 }).lean();
      unreadMemberIds = users.map((user) => user._id.toString());
    }

    updateConversationAfterCreateMessage(
      conversation,
      createdMessage,
      senderId,
      unreadMemberIds
    );

    await conversation.save();
    committed = true;

    let responseMessage = createdMessage;

    try {
      const populatedMessage = await populateMessageWithGift(createdMessage._id);
      if (populatedMessage) {
        responseMessage = populatedMessage;
        emitNewMessage(io, conversation, populatedMessage);
      }
    } catch (emitError) {
      console.error("Không emit được tin nhắn nhóm mới", emitError);
    }

    if (createdAdjustment?._id) {
      queueWalletAdjustmentEmail({
        adjustment: createdAdjustment,
        user: req.user,
      });
    }

    return res.status(201).json({ message: formatMessagePayload(responseMessage) });
  } catch (error) {
    if (!committed) {
      if (createdGift?._id) {
        await CommunityGift.findByIdAndDelete(createdGift._id).catch(() => null);
      }
      if (createdMessage?._id) {
        await Message.findByIdAndDelete(createdMessage._id).catch(() => null);
      }
      if (createdAdjustment?._id) {
        await WalletAdjustment.findByIdAndDelete(createdAdjustment._id).catch(() => null);
      }
    }
    console.error("Lỗi xảy ra khi gửi tin nhắn nhóm", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const submitCommunityUserReport = async (req, res) => {
  try {
    const normalizedReport = normalizeCommunityUserReportPayload(req.body);
    const reporterId = req.user._id;

    if (!normalizedReport) {
      return res.status(400).json({
        message: "Thông tin tố cáo không hợp lệ. Vui lòng kiểm tra lại.",
      });
    }

    if (normalizedReport.targetUserId === reporterId.toString()) {
      return res.status(400).json({ message: "Bạn không thể tự tố cáo chính mình." });
    }

    const conversation = await Conversation.findById(normalizedReport.conversationId).select(
      "_id systemKey group"
    );

    if (!conversation || conversation.systemKey !== GLOBAL_COMMUNITY_KEY) {
      return res.status(404).json({ message: "Không tìm thấy phòng cộng đồng để gửi tố cáo." });
    }

    const targetUser = await User.findById(normalizedReport.targetUserId).select(
      "_id accountId displayName"
    );

    if (!targetUser) {
      return res.status(404).json({ message: "Người dùng bị tố cáo không tồn tại." });
    }

    let reportedMessage = null;

    if (normalizedReport.messageId) {
      reportedMessage = await Message.findById(normalizedReport.messageId)
        .select("conversationId senderId content communityGiftId")
        .populate({
          path: "communityGiftId",
          select: "title note",
        });

      if (
        !reportedMessage ||
        reportedMessage.conversationId?.toString?.() !== conversation._id.toString() ||
        reportedMessage.senderId?.toString?.() !== targetUser._id.toString()
      ) {
        return res.status(400).json({
          message: "Ngữ cảnh tố cáo không khớp với user trong phòng cộng đồng.",
        });
      }
    } else {
      reportedMessage = await Message.findOne({
        conversationId: conversation._id,
        senderId: targetUser._id,
      })
        .sort({ createdAt: -1 })
        .select("conversationId senderId content communityGiftId")
        .populate({
          path: "communityGiftId",
          select: "title note",
        });

      if (!reportedMessage) {
        return res.status(400).json({
          message: "Không tìm thấy hoạt động của user này trong phòng cộng đồng.",
        });
      }
    }

    const existingPendingReport = await CommunityUserReport.findOne({
      reporterId,
      targetUserId: targetUser._id,
      conversationId: conversation._id,
      status: { $in: ["pending", "in_review"] },
    }).select("_id status createdAt");

    if (existingPendingReport) {
      return res.status(409).json({
        message: "Bạn đã gửi tố cáo cho user này rồi. Admin đang xem xét.",
      });
    }

    const report = await CommunityUserReport.create({
      reporterId,
      reporterAccountId: req.user.accountId ?? "",
      reporterDisplayName: req.user.displayName,
      targetUserId: targetUser._id,
      targetAccountId: targetUser.accountId ?? "",
      targetDisplayName: targetUser.displayName,
      conversationId: conversation._id,
      conversationLabel: getConversationLabel(conversation),
      messageId: reportedMessage?._id ?? null,
      latestMessageExcerpt: getReportMessageExcerpt(reportedMessage),
      category: normalizedReport.category,
      description: normalizedReport.description,
    });

    return res.status(201).json({
      message: "Đã gửi tố cáo tới admin để kiểm tra.",
      report: {
        id: report._id.toString(),
        status: report.status,
        createdAt: report.createdAt,
      },
    });
  } catch (error) {
    console.error("Lỗi khi gửi tố cáo user cộng đồng", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const openCommunityGift = async (req, res) => {
  try {
    const { giftId } = req.params;
    const userId = req.user._id;

    let gift = await CommunityGift.findById(giftId).populate({
      path: "claims.userId",
      select: "displayName avatarUrl",
    });

    if (!gift) {
      return res.status(404).json({ message: "Không tìm thấy món quà này." });
    }

    const conversation = await Conversation.findById(gift.conversationId);

    if (!conversation || !canAccessConversation(conversation, userId)) {
      return res.status(403).json({ message: "Bạn không có quyền mở món quà này." });
    }

    if (conversation.systemKey === GLOBAL_COMMUNITY_KEY && isCommunityChatLocked(req.user)) {
      return res.status(423).json(buildCommunityChatLockedResponse(req.user));
    }

    if (gift.senderId.toString() === userId.toString()) {
      return res.status(403).json({ message: "Bạn không thể tự mở món quà mình vừa gửi." });
    }

    const existingClaim = gift.claims.find(
      (claim) => claim.userId?._id?.toString?.() === userId.toString()
    );

    if (existingClaim) {
      return res.status(200).json({
        status: "already_claimed",
        gift: serializeCommunityGift(gift),
        claim: {
          userId: userId.toString(),
          displayName: existingClaim.userId.displayName ?? req.user.displayName,
          avatarUrl: existingClaim.userId.avatarUrl ?? null,
          amount: Number(existingClaim.amount ?? 0),
          claimedAt: existingClaim.claimedAt,
        },
      });
    }

    if (gift.remainingSlots <= 0 || gift.status === "exhausted") {
      return res.status(200).json({
        status: "sold_out",
        message: "Tiếc quá, món quà này đã được nhận hết rồi.",
        gift: serializeCommunityGift(gift),
      });
    }

    const claimAmount = resolveCommunityGiftClaimAmount(
      gift.remainingAmount,
      gift.remainingSlots
    );
    const claimRecord = {
      userId,
      amount: claimAmount,
      claimedAt: new Date(),
    };

    const updatedGift = await CommunityGift.findOneAndUpdate(
      {
        _id: giftId,
        senderId: { $ne: userId },
        "claims.userId": { $ne: userId },
        remainingSlots: gift.remainingSlots,
        remainingAmount: gift.remainingAmount,
        status: "active",
      },
      {
        $push: { claims: claimRecord },
        $inc: {
          remainingSlots: -1,
          remainingAmount: -claimAmount,
        },
      },
      { new: true }
    ).populate({
      path: "claims.userId",
      select: "displayName avatarUrl",
    });

    if (!updatedGift) {
      gift = await CommunityGift.findById(giftId).populate({
        path: "claims.userId",
        select: "displayName avatarUrl",
      });

      const refetchedClaim = gift?.claims.find(
        (claim) => claim.userId?._id?.toString?.() === userId.toString()
      );

      if (refetchedClaim) {
        return res.status(200).json({
          status: "already_claimed",
          gift: serializeCommunityGift(gift),
          claim: {
            userId: userId.toString(),
            displayName: refetchedClaim.userId.displayName ?? req.user.displayName,
            avatarUrl: refetchedClaim.userId.avatarUrl ?? null,
            amount: Number(refetchedClaim.amount ?? 0),
            claimedAt: refetchedClaim.claimedAt,
          },
        });
      }

      return res.status(200).json({
        status: "sold_out",
        message: "Tiếc quá, món quà này đã được nhận hết rồi.",
        gift: serializeCommunityGift(gift),
      });
    }

    if (updatedGift.remainingSlots <= 0 || updatedGift.remainingAmount <= 0) {
      updatedGift.status = "exhausted";
      updatedGift.remainingSlots = Math.max(Number(updatedGift.remainingSlots ?? 0), 0);
      updatedGift.remainingAmount = Math.max(Number(updatedGift.remainingAmount ?? 0), 0);
      await updatedGift.save();
    }

    try {
      const adjustment = await WalletAdjustment.create({
        userId: req.user._id,
        userAccountId: req.user.accountId,
        userDisplayName: req.user.displayName,
        direction: "credit",
        reasonCode: "community_gift_claim",
        reasonLabel: "Nhận quà cộng đồng từ phòng chat.",
        amount: claimAmount,
        note: updatedGift.note || "Mở quà cộng đồng thành công.",
      });
      queueWalletAdjustmentEmail({
        adjustment,
        user: req.user,
      });
    } catch (walletError) {
      await CommunityGift.findByIdAndUpdate(updatedGift._id, {
        $pull: {
          claims: {
            userId,
            amount: claimAmount,
            claimedAt: claimRecord.claimedAt,
          },
        },
        $inc: {
          remainingSlots: 1,
          remainingAmount: claimAmount,
        },
        $set: {
          status: "active",
        },
      }).catch(() => null);

      throw walletError;
    }

    try {
      const giftMessage = await populateMessageWithGift(updatedGift.messageId);
      if (giftMessage) {
        emitCommunityGiftUpdated(io, conversation._id, giftMessage);
      }
    } catch (emitError) {
      console.error("Không emit được cập nhật quà cộng đồng", emitError);
    }

    return res.status(200).json({
      status: "claimed",
      gift: serializeCommunityGift(updatedGift),
      claim: {
        userId: userId.toString(),
        displayName: req.user.displayName,
        avatarUrl: req.user.avatarUrl ?? null,
        amount: claimAmount,
        claimedAt: claimRecord.claimedAt,
      },
    });
  } catch (error) {
    console.error("Lỗi xảy ra khi mở quà cộng đồng", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
