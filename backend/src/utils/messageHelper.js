import { serializeCommunityGift } from "./communityGiftHelper.js";

export const updateConversationAfterCreateMessage = (
  conversation,
  message,
  senderId,
  memberIds = null
) => {
  conversation.set({
    seenBy: [],
    lastMessageAt: message.createdAt,
    lastMessage: {
      _id: message._id,
      content: message.content,
      senderId,
      createdAt: message.createdAt,
    },
  });

  const targetMemberIds =
    Array.isArray(memberIds) && memberIds.length > 0
      ? memberIds.map((memberId) => memberId.toString())
      : conversation.participants.map((participant) => participant.userId.toString());

  targetMemberIds.forEach((memberId) => {
    const isSender = memberId === senderId.toString();
    const prevCount = conversation.unreadCounts.get(memberId) || 0;
    conversation.unreadCounts.set(memberId, isSender ? 0 : prevCount + 1);
  });
};

export const formatMessagePayload = (message) => {
  const sender =
    message?.senderId && typeof message.senderId === "object"
      ? {
          _id: message.senderId._id?.toString?.() ?? message.senderId._id ?? "",
          displayName: message.senderId.displayName ?? "Thành viên",
          avatarUrl: message.senderId.avatarUrl ?? null,
        }
      : undefined;
  const communityGift =
    message?.communityGiftId && typeof message.communityGiftId === "object"
      ? serializeCommunityGift(message.communityGiftId)
      : null;

  return {
    ...message.toObject(),
    senderId: sender?._id ?? message.senderId?.toString?.() ?? message.senderId,
    sender,
    type: message.type ?? "text",
    communityGiftId:
      message.communityGiftId?._id?.toString?.() ??
      message.communityGiftId?.toString?.() ??
      message.communityGiftId ??
      null,
    communityGift,
  };
};

export const emitNewMessage = (io, conversation, message) => {
  io.to(conversation._id.toString()).emit("new-message", {
    message: formatMessagePayload(message),
    conversation: {
      _id: conversation._id,
      lastMessage: conversation.lastMessage,
      lastMessageAt: conversation.lastMessageAt,
    },
    unreadCounts: conversation.unreadCounts,
  });
};

export const emitCommunityGiftUpdated = (io, conversationId, message) => {
  io.to(conversationId.toString()).emit("community-gift-updated", {
    conversationId: conversationId.toString(),
    message: formatMessagePayload(message),
  });
};
