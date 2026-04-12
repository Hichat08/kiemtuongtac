import Conversation from "../models/Conversation.js";

export const GLOBAL_COMMUNITY_KEY = "global-community";
export const GLOBAL_COMMUNITY_NAME = "Community";

export const ensureCommunityConversation = async () => {
  let conversation = await Conversation.findOne({ systemKey: GLOBAL_COMMUNITY_KEY });

  if (conversation) {
    return conversation;
  }

  try {
    conversation = await Conversation.create({
      systemKey: GLOBAL_COMMUNITY_KEY,
      type: "group",
      participants: [],
      group: {
        name: GLOBAL_COMMUNITY_NAME,
      },
      lastMessageAt: new Date(0),
      unreadCounts: new Map(),
    });
  } catch (error) {
    if (error?.code === 11000) {
      conversation = await Conversation.findOne({ systemKey: GLOBAL_COMMUNITY_KEY });
    } else {
      throw error;
    }
  }

  return conversation;
};
