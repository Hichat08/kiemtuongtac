export interface Participant {
  _id: string;
  displayName: string;
  avatarUrl?: string | null;
  joinedAt: string;
}

export interface SeenUser {
  _id: string;
  displayName?: string;
  avatarUrl?: string | null;
}

export interface Group {
  name: string;
  createdBy: string;
}

export interface LastMessage {
  _id: string;
  content: string;
  createdAt: string;
  sender: {
    _id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
}

export interface Conversation {
  _id: string;
  systemKey?: string | null;
  type: "direct" | "group";
  group: Group;
  participants: Participant[];
  lastMessageAt: string;
  seenBy: SeenUser[];
  lastMessage: LastMessage | null;
  unreadCounts: Record<string, number>; // key = userId, value = unread count
  createdAt: string;
  updatedAt: string;
}

export interface ConversationResponse {
  conversations: Conversation[];
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  type?: "text" | "community_gift";
  communityGiftId?: string | null;
  communityGift?: CommunityGift | null;
  sender?: {
    _id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  content: string | null;
  imgUrl?: string | null;
  updatedAt?: string | null;
  createdAt: string;
  isOwn?: boolean;
}

export interface CommunityGiftClaim {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  amount: number;
  claimedAt: string;
}

export interface CommunityGift {
  _id: string;
  conversationId: string;
  messageId: string;
  senderId: string;
  senderAccountId: string;
  senderDisplayName: string;
  totalAmount: number;
  remainingAmount: number;
  recipientLimit: number;
  remainingSlots: number;
  title: string;
  note: string;
  status: "active" | "exhausted";
  claims: CommunityGiftClaim[];
  createdAt: string;
  updatedAt: string;
}
