import type { Socket } from "socket.io-client";
import type { Conversation, Message } from "./chat";
import type { Friend, FriendRequest, User } from "./user";

export interface AuthState {
  accessToken: string | null;
  user: User | null;
  loading: boolean;

  setAccessToken: (accessToken: string) => void;
  setUser: (user: User) => void;
  clearState: () => void;
  requestSignUpCode: (email: string) => Promise<boolean>;
  verifyEmail: (email: string, code: string) => Promise<boolean>;
  signUp: (payload: SignUpPayload) => Promise<boolean>;
  signIn: (credential: string, password: string) => Promise<boolean>;
  signInWithGoogle: (accessToken: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  fetchMe: (options?: { silent?: boolean }) => Promise<void>;
  refresh: () => Promise<void>;
}

export interface SignUpPayload {
  email: string;
  fullName: string;
  password: string;
  username: string;
  referralCode?: string;
}

export interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (dark: boolean) => void;
}

export interface ChatState {
  conversations: Conversation[];
  messages: Record<
    string,
    {
      items: Message[];
      hasMore: boolean; // infinite-scroll
      nextCursor?: string | null; // phân trang
    }
  >;
  activeConversationId: string | null;
  convoLoading: boolean;
  messageLoading: boolean;
  loading: boolean;
  reset: () => void;

  setActiveConversation: (id: string | null) => void;
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId?: string) => Promise<void>;
  sendDirectMessage: (
    recipientId: string,
    content: string,
    imgUrl?: string
  ) => Promise<void>;
  sendGroupMessage: (
    conversationId: string,
    content: string,
    imgUrl?: string,
    communityGift?: {
      amount: number;
      recipientCount: number;
      message: string;
      title?: string;
    }
  ) => Promise<void>;
  // add message
  addMessage: (message: Message) => Promise<void>;
  updateMessage: (
    conversationId: string,
    messageId: string,
    updater: (message: Message) => Message
  ) => void;
  // update convo
  updateConversation: (
    conversation: Partial<Conversation> & Pick<Conversation, "_id">
  ) => void;
  resetConversationState: (
    conversation: Partial<Conversation> & Pick<Conversation, "_id">
  ) => void;
  removeConversationBySystemKey: (systemKey: string) => void;
  markAsSeen: () => Promise<void>;
  addConvo: (convo: Conversation) => void;
  createConversation: (
    type: "group" | "direct",
    name: string,
    memberIds: string[]
  ) => Promise<void>;
}

export interface SocketState {
  socket: Socket | null;
  onlineUsers: string[];
  connectSocket: () => void;
  disconnectSocket: () => void;
}

export interface FriendState {
  friends: Friend[];
  loading: boolean;
  receivedList: FriendRequest[];
  sentList: FriendRequest[];
  searchByUsername: (username: string) => Promise<User | null>;
  addFriend: (to: string, message?: string) => Promise<string>;
  getAllFriendRequests: () => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  getFriends: () => Promise<void>;
}

export interface UserState {
  updateAvatarUrl: (formData: FormData) => Promise<void>;
}
