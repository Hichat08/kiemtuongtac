import { create } from "zustand";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import { useAuthStore } from "./useAuthStore";
import type { SocketState } from "@/types/store";
import { useChatStore } from "./useChatStore";

const baseURL = import.meta.env.VITE_SOCKET_URL;
const GLOBAL_COMMUNITY_KEY = "global-community";

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  onlineUsers: [],
  connectSocket: () => {
    const accessToken = useAuthStore.getState().accessToken;
    const existingSocket = get().socket;

    if (existingSocket) return; // tránh tạo nhiều socket

    const socket: Socket = io(baseURL, {
      auth: { token: accessToken },
      transports: ["websocket"],
    });

    set({ socket });

    socket.on("connect", () => {
      console.log("Đã kết nối với socket");
    });

    // online users
    socket.on("online-users", (userIds) => {
      set({ onlineUsers: userIds });
    });

    // new message
    socket.on("new-message", ({ message, conversation, unreadCounts }) => {
      useChatStore.getState().addMessage(message);

      const sender = message.sender;
      const lastMessage = {
        _id: conversation.lastMessage._id,
        content: conversation.lastMessage.content,
        createdAt: conversation.lastMessage.createdAt,
        sender: {
          _id: sender?._id ?? conversation.lastMessage.senderId,
          displayName: sender?.displayName ?? "",
          avatarUrl: sender?.avatarUrl ?? null,
        },
      };

      const updatedConversation = {
        ...conversation,
        lastMessage,
        unreadCounts,
      };

      if (useChatStore.getState().activeConversationId === message.conversationId) {
        useChatStore.getState().markAsSeen();
      }

      useChatStore.getState().updateConversation(updatedConversation);
    });

    socket.on("community-gift-updated", ({ conversationId, message }) => {
      useChatStore.getState().updateMessage(conversationId, message._id, () => ({
        ...message,
      }));
    });

    // read message
    socket.on("read-message", ({ conversation, lastMessage }) => {
      const updated = {
        _id: conversation._id,
        lastMessage,
        lastMessageAt: conversation.lastMessageAt,
        unreadCounts: conversation.unreadCounts,
        seenBy: conversation.seenBy,
      };

      useChatStore.getState().updateConversation(updated);
    });

    // new group chat
    socket.on("new-group", (conversation) => {
      useChatStore.getState().addConvo(conversation);
      socket.emit("join-conversation", conversation._id);
    });

    socket.on("support-room-reset", ({ conversation }) => {
      useChatStore.getState().resetConversationState(conversation);
    });

    socket.on("community-chat-status-changed", ({ status, lockedAt, note }) => {
      const currentUser = useAuthStore.getState().user;

      if (currentUser) {
        useAuthStore.getState().setUser({
          ...currentUser,
          communityChatStatus: status,
          communityChatLockedAt: lockedAt ?? null,
          communityChatModerationNote: note ?? "",
        });
      }

      if (status === "locked") {
        useChatStore.getState().removeConversationBySystemKey(GLOBAL_COMMUNITY_KEY);
        toast.error(note || "Admin đã khóa chat cộng đồng của bạn.");
        return;
      }

      toast.success("Chat cộng đồng của bạn đã được mở lại.");
      void useChatStore.getState().fetchConversations();
    });
  },
  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  },
}));
