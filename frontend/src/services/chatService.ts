import api from "@/lib/axios";
import type { CommunityGift, CommunityGiftClaim, ConversationResponse, Message } from "@/types/chat";
import type {
  CommunityUserReportCategory,
  CommunityUserReportRow,
} from "@/types/community-report";

interface FetchMessageProps {
  messages: Message[];
  cursor?: string;
}

interface OpenCommunityGiftResponse {
  status: "claimed" | "already_claimed" | "sold_out";
  message?: string;
  gift: CommunityGift | null;
  claim?: CommunityGiftClaim;
}

interface SubmitCommunityUserReportResponse {
  message: string;
  report: Pick<CommunityUserReportRow, "id" | "status" | "createdAt">;
}

const pageLimit = 50;

export const chatService = {
  async fetchConversations(): Promise<ConversationResponse> {
    const res = await api.get("/conversations");
    return res.data;
  },

  async fetchMessages(id: string, cursor?: string): Promise<FetchMessageProps> {
    const normalizedCursor = `${cursor ?? ""}`.trim();
    const res = await api.get(`/conversations/${id}/messages`, {
      params: {
        limit: pageLimit,
        ...(normalizedCursor ? { cursor: normalizedCursor } : {}),
      },
    });

    return { messages: res.data.messages, cursor: res.data.nextCursor };
  },

  async sendDirectMessage(
    recipientId: string,
    content: string = "",
    imgUrl?: string,
    conversationId?: string
  ) {
    const res = await api.post("/messages/direct", {
      recipientId,
      content,
      imgUrl,
      conversationId,
    });

    return res.data.message;
  },

  async sendGroupMessage(
    conversationId: string,
    content: string = "",
    imgUrl?: string,
    communityGift?: {
      amount: number;
      recipientCount: number;
      message: string;
      title?: string;
    }
  ) {
    const res = await api.post("/messages/group", {
      conversationId,
      content,
      imgUrl,
      communityGift,
    });
    return res.data.message;
  },

  async openCommunityGift(giftId: string) {
    const res = await api.post<OpenCommunityGiftResponse>(
      `/messages/community-gifts/${giftId}/open`
    );
    return res.data;
  },

  async submitCommunityUserReport(payload: {
    targetUserId: string;
    conversationId: string;
    messageId?: string | null;
    category: CommunityUserReportCategory;
    description?: string;
  }) {
    const res = await api.post<SubmitCommunityUserReportResponse>(
      "/messages/community-reports",
      payload
    );
    return res.data;
  },

  async markAsSeen(conversationId: string) {
    const res = await api.patch(`/conversations/${conversationId}/seen`);
    return res.data;
  },

  async ensureSupportConversation() {
    const res = await api.post("/conversations/support-room");
    return res.data.conversation;
  },

  async resetSupportConversation(conversationId: string) {
    const res = await api.post(`/conversations/${conversationId}/support-reset`);
    return res.data.conversation;
  },

  async createConversation(
    type: "direct" | "group",
    name: string,
    memberIds: string[]
  ) {
    const res = await api.post("/conversations", { type, name, memberIds });
    return res.data.conversation;
  },
};
