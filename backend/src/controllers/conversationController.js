import Conversation from "../models/Conversation.js";
import CommunityGift from "../models/CommunityGift.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { io } from "../socket/index.js";
import {
  ensureCommunityConversation,
  GLOBAL_COMMUNITY_KEY,
} from "../utils/communityConversationHelper.js";
import { formatMessagePayload } from "../utils/messageHelper.js";

const SUPPORT_CONVERSATION_KEY_PREFIX = "support-room";
const SUPPORT_GROUP_NAME = "Hỗ trợ trực tuyến";

const isCommunityConversation = (conversation) =>
  conversation?.systemKey === GLOBAL_COMMUNITY_KEY;

const isSupportConversation = (conversation) =>
  `${conversation?.systemKey ?? ""}`.startsWith(`${SUPPORT_CONVERSATION_KEY_PREFIX}:`);

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

const buildSupportConversationKey = (userId) =>
  `${SUPPORT_CONVERSATION_KEY_PREFIX}:${userId}`;

const isConversationMember = (conversation, userId) =>
  (conversation?.participants ?? []).some(
    (participant) => participant.userId?.toString() === userId.toString()
  );

const canAccessConversation = (conversation, userId, role = "user") =>
  isCommunityConversation(conversation) ||
  (role === "admin" && isSupportConversation(conversation)) ||
  isConversationMember(conversation, userId);

const buildConversationQuery = (userId, role = "user", includeCommunity = true) => {
  const clauses = [{ "participants.userId": userId }];

  if (includeCommunity) {
    clauses.push({ systemKey: GLOBAL_COMMUNITY_KEY });
  }

  if (role === "admin") {
    clauses.push({
      systemKey: new RegExp(`^${SUPPORT_CONVERSATION_KEY_PREFIX}:`),
    });
  }

  return { $or: clauses };
};

const formatConversation = (conversation) => {
  const participants = (conversation.participants || []).map((participant) => ({
    _id: participant.userId?._id,
    displayName: participant.userId?.displayName,
    avatarUrl: participant.userId?.avatarUrl ?? null,
    joinedAt: participant.joinedAt,
  }));

  return {
    ...conversation.toObject(),
    unreadCounts: conversation.unreadCounts || {},
    participants,
  };
};

export const createConversation = async (req, res) => {
  try {
    const { type, name, memberIds } = req.body;
    const userId = req.user._id;

    if (
      !type ||
      (type === "group" && !name) ||
      !memberIds ||
      !Array.isArray(memberIds) ||
      memberIds.length === 0
    ) {
      return res
        .status(400)
        .json({ message: "Tên nhóm và danh sách thành viên là bắt buộc" });
    }

    let conversation;

    if (type === "direct") {
      const participantId = memberIds[0];

      conversation = await Conversation.findOne({
        type: "direct",
        "participants.userId": { $all: [userId, participantId] },
      });

      if (!conversation) {
        conversation = new Conversation({
          type: "direct",
          participants: [{ userId }, { userId: participantId }],
          lastMessageAt: new Date(),
        });

        await conversation.save();
      }
    }

    if (type === "group") {
      conversation = new Conversation({
        type: "group",
        participants: [{ userId }, ...memberIds.map((id) => ({ userId: id }))],
        group: {
          name,
          createdBy: userId,
        },
        lastMessageAt: new Date(),
      });

      await conversation.save();
    }

    if (!conversation) {
      return res.status(400).json({ message: "Conversation type không hợp lệ" });
    }

    await conversation.populate([
      { path: "participants.userId", select: "displayName avatarUrl" },
      { path: "seenBy", select: "displayName avatarUrl" },
      { path: "lastMessage.senderId", select: "displayName avatarUrl" },
    ]);

    const formatted = formatConversation(conversation);

    if (type === "group") {
      memberIds.forEach((memberId) => {
        io.to(memberId).emit("new-group", formatted);
      });
    }

    if (type === "direct") {
      io.to(userId).emit("new-group", formatted);
      io.to(memberIds[0]).emit("new-group", formatted);
    }

    return res.status(201).json({ conversation: formatted });
  } catch (error) {
    console.error("Lỗi khi tạo conversation", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const ensureSupportConversation = async (req, res) => {
  try {
    const userId = req.user._id;
    const supportKey = buildSupportConversationKey(userId.toString());
    let created = false;

    let conversation = await Conversation.findOne({ systemKey: supportKey });
    const adminUsers = await User.find({ role: "admin" }, { _id: 1 }).lean();
    const adminIds = adminUsers
      .map((admin) => admin._id?.toString?.() ?? "")
      .filter((id) => Boolean(id) && id !== userId.toString());

    if (!conversation && adminIds.length === 0) {
      return res.status(503).json({ message: "Hiện chưa có admin trực hỗ trợ." });
    }

    const participantIds = Array.from(new Set([userId.toString(), ...adminIds]));

    if (!conversation) {
      try {
        conversation = await Conversation.create({
          systemKey: supportKey,
          type: "group",
          participants: participantIds.map((participantId) => ({
            userId: participantId,
            joinedAt: new Date(),
          })),
          group: {
            name: SUPPORT_GROUP_NAME,
            createdBy: adminIds[0] ?? userId,
          },
          lastMessageAt: new Date(),
          unreadCounts: new Map(),
        });
        created = true;
      } catch (error) {
        if (error?.code !== 11000) {
          throw error;
        }

        conversation = await Conversation.findOne({ systemKey: supportKey });
      }
    }

    if (!conversation) {
      return res.status(500).json({ message: "Không tạo được phòng hỗ trợ." });
    }

    const existingParticipantIds = new Set(
      (conversation.participants ?? []).map((participant) => participant.userId?.toString?.() ?? "")
    );
    let updated = false;

    participantIds.forEach((participantId) => {
      if (existingParticipantIds.has(participantId)) {
        return;
      }

      conversation.participants.push({
        userId: participantId,
        joinedAt: new Date(),
      });
      updated = true;
    });

    if (!conversation.group?.name?.trim()) {
      conversation.group = {
        name: SUPPORT_GROUP_NAME,
        createdBy: adminIds[0] ?? userId,
      };
      updated = true;
    }

    if (!conversation.lastMessageAt) {
      conversation.lastMessageAt = new Date();
      updated = true;
    }

    if (updated) {
      await conversation.save();
    }

    await conversation.populate([
      { path: "participants.userId", select: "displayName avatarUrl" },
      { path: "seenBy", select: "displayName avatarUrl" },
      { path: "lastMessage.senderId", select: "displayName avatarUrl" },
    ]);

    const formatted = formatConversation(conversation);

    if (created) {
      participantIds.forEach((participantId) => {
        io.to(participantId).emit("new-group", formatted);
      });
    }

    return res.status(created ? 201 : 200).json({ conversation: formatted });
  } catch (error) {
    console.error("Lỗi khi chuẩn bị phòng hỗ trợ", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const resetSupportConversation = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Chỉ admin mới được reset phòng hỗ trợ." });
    }

    const { conversationId } = req.params;
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({ message: "Phòng hỗ trợ không tồn tại." });
    }

    if (!isSupportConversation(conversation)) {
      return res.status(400).json({ message: "Đây không phải phòng hỗ trợ riêng." });
    }

    await CommunityGift.deleteMany({ conversationId: conversation._id });
    await Message.deleteMany({ conversationId: conversation._id });

    conversation.set({
      lastMessageAt: null,
      lastMessage: null,
      seenBy: [],
      unreadCounts: new Map(),
    });

    await conversation.save();
    await conversation.populate([
      { path: "participants.userId", select: "displayName avatarUrl" },
      { path: "seenBy", select: "displayName avatarUrl" },
      { path: "lastMessage.senderId", select: "displayName avatarUrl" },
    ]);

    const formatted = formatConversation(conversation);

    io.to(conversation._id.toString()).emit("support-room-reset", {
      conversation: formatted,
    });

    return res.status(200).json({
      message: "Đã làm mới phòng hỗ trợ.",
      conversation: formatted,
    });
  } catch (error) {
    console.error("Lỗi khi reset phòng hỗ trợ", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const getConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role ?? "user";
    await ensureCommunityConversation();

    if (userRole !== "admin" && req.user.moderationStatus === "locked") {
      const supportKey = buildSupportConversationKey(userId.toString());
      const conversation = await Conversation.findOne({ systemKey: supportKey })
        .populate({
          path: "participants.userId",
          select: "displayName avatarUrl",
        })
        .populate({
          path: "lastMessage.senderId",
          select: "displayName avatarUrl",
        })
        .populate({
          path: "seenBy",
          select: "displayName avatarUrl",
        });

      return res.status(200).json({
        conversations: conversation ? [formatConversation(conversation)] : [],
      });
    }

    const conversations = await Conversation.find(
      buildConversationQuery(userId, userRole, !isCommunityChatLocked(req.user))
    )
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate({
        path: "participants.userId",
        select: "displayName avatarUrl",
      })
      .populate({
        path: "lastMessage.senderId",
        select: "displayName avatarUrl",
      })
      .populate({
        path: "seenBy",
        select: "displayName avatarUrl",
      });

    return res
      .status(200)
      .json({ conversations: conversations.map((conversation) => formatConversation(conversation)) });
  } catch (error) {
    console.error("Lỗi xảy ra khi lấy conversations", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, cursor } = req.query;
    const userId = req.user._id;
    const userRole = req.user.role ?? "user";
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({ message: "Conversation không tồn tại" });
    }

    if (userRole !== "admin" && req.user.moderationStatus === "locked" && !isSupportConversation(conversation)) {
      return res.status(403).json({ message: "Chỉ được truy cập phòng hỗ trợ khi tài khoản bị khóa." });
    }

    if (isCommunityConversation(conversation) && isCommunityChatLocked(req.user)) {
      return res.status(423).json(buildCommunityChatLockedResponse(req.user));
    }

    if (!canAccessConversation(conversation, userId, userRole)) {
      return res.status(403).json({ message: "Bạn không có quyền xem cuộc trò chuyện này" });
    }

    const parsedLimit = Number.parseInt(limit, 10);
    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : 50;
    const normalizedCursor = `${cursor ?? ""}`.trim();
    const parsedCursor =
      normalizedCursor && normalizedCursor !== "undefined"
        ? new Date(normalizedCursor)
        : null;

    const query = { conversationId };

    if (parsedCursor && !Number.isNaN(parsedCursor.getTime())) {
      query.createdAt = { $lt: parsedCursor };
    }

    let messages = await Message.find(query)
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
      })
      .sort({ createdAt: -1 })
      .limit(safeLimit + 1);

    let nextCursor = null;

    if (messages.length > safeLimit) {
      const nextMessage = messages[messages.length - 1];
      nextCursor = nextMessage.createdAt.toISOString();
      messages.pop();
    }

    messages = messages.reverse().map((message) => formatMessagePayload(message));

    return res.status(200).json({
      messages,
      nextCursor,
    });
  } catch (error) {
    console.error("Lỗi xảy ra khi lấy messages", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const getUserConversationsForSocketIO = async (user) => {
  try {
    const userId = user?._id ?? user;
    const userRole = user?.role ?? "user";
    await ensureCommunityConversation();

    const conversations = await Conversation.find(
      buildConversationQuery(userId, userRole, !isCommunityChatLocked(user)),
      {
      _id: 1,
      }
    );

    return conversations.map((conversation) => conversation._id.toString());
  } catch (error) {
    console.error("Lỗi khi fetch conversations: ", error);
    return [];
  }
};

export const markAsSeen = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id.toString();
    const userRole = req.user.role ?? "user";

    const conversation = await Conversation.findById(conversationId).lean();

    if (!conversation) {
      return res.status(404).json({ message: "Conversation không tồn tại" });
    }

    if (userRole !== "admin" && req.user.moderationStatus === "locked" && !isSupportConversation(conversation)) {
      return res.status(403).json({ message: "Chỉ được truy cập phòng hỗ trợ khi tài khoản bị khóa." });
    }

    if (isCommunityConversation(conversation) && isCommunityChatLocked(req.user)) {
      return res.status(423).json(buildCommunityChatLockedResponse(req.user));
    }

    if (!canAccessConversation(conversation, userId, userRole)) {
      return res.status(403).json({ message: "Bạn không có quyền cập nhật cuộc trò chuyện này" });
    }

    const last = conversation.lastMessage;

    if (!last) {
      return res.status(200).json({ message: "Không có tin nhắn để mark as seen" });
    }

    if (last.senderId.toString() === userId) {
      return res.status(200).json({ message: "Sender không cần mark as seen" });
    }

    const updated = await Conversation.findByIdAndUpdate(
      conversationId,
      {
        $addToSet: { seenBy: userId },
        $set: { [`unreadCounts.${userId}`]: 0 },
      },
      {
        new: true,
      }
    );

    io.to(conversationId).emit("read-message", {
      conversation: updated,
      lastMessage: {
        _id: updated?.lastMessage._id,
        content: updated?.lastMessage.content,
        createdAt: updated?.lastMessage.createdAt,
        sender: {
          _id: updated?.lastMessage.senderId,
        },
      },
    });

    return res.status(200).json({
      message: "Marked as seen",
      seenBy: updated?.seenBy || [],
      myUnreadCount: updated?.unreadCounts?.get?.(userId) ?? updated?.unreadCounts?.[userId] ?? 0,
    });
  } catch (error) {
    console.error("Lỗi khi mark as seen", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
