import { friendService } from "@/services/friendService";
import type { FriendState } from "@/types/store";
import { create } from "zustand";

const FRIEND_REQUEST_FRESHNESS_MS = 10_000;
let inflightFriendRequestFetch: Promise<void> | null = null;
let lastFriendRequestFetchAt = 0;

export const useFriendStore = create<FriendState>((set) => ({
  friends: [],
  loading: false,
  receivedList: [],
  sentList: [],
  searchByUsername: async (username) => {
    try {
      set({ loading: true });

      const user = await friendService.searchByUsername(username);

      return user;
    } catch (error) {
      console.error("Lỗi xảy ra khi tìm user bằng username", error);
      return null;
    } finally {
      set({ loading: false });
    }
  },
  addFriend: async (to, message) => {
    try {
      set({ loading: true });
      const resultMessage = await friendService.sendFriendRequest(to, message);
      lastFriendRequestFetchAt = 0;
      return resultMessage;
    } catch (error) {
      console.error("Lỗi xảy ra khi addFriend", error);
      return "Lỗi xảy ra khi gửi kết bạn. Hãy thử lại";
    } finally {
      set({ loading: false });
    }
  },
  getAllFriendRequests: async () => {
    const isFresh = Date.now() - lastFriendRequestFetchAt < FRIEND_REQUEST_FRESHNESS_MS;

    if (isFresh) {
      return;
    }

    if (inflightFriendRequestFetch) {
      return inflightFriendRequestFetch;
    }

    inflightFriendRequestFetch = (async () => {
      try {
        set({ loading: true });

        const result = await friendService.getAllFriendRequest();

        if (!result) {
          return;
        }

        const { received, sent } = result;

        set({ receivedList: received, sentList: sent });
        lastFriendRequestFetchAt = Date.now();
      } catch (error) {
        console.error("Lỗi xảy ra khi getAllFriendRequests", error);
      } finally {
        inflightFriendRequestFetch = null;
        set({ loading: false });
      }
    })();

    return inflightFriendRequestFetch;
  },
  acceptRequest: async (requestId) => {
    try {
      set({ loading: true });
      await friendService.acceptRequest(requestId);
      lastFriendRequestFetchAt = 0;

      set((state) => ({
        receivedList: state.receivedList.filter((r) => r._id !== requestId),
      }));
    } catch (error) {
      console.error("Lỗi xảy ra khi acceptRequest", error);
    }
  },
  declineRequest: async (requestId) => {
    try {
      set({ loading: true });
      await friendService.declineRequest(requestId);
      lastFriendRequestFetchAt = 0;

      set((state) => ({
        receivedList: state.receivedList.filter((r) => r._id !== requestId),
      }));
    } catch (error) {
      console.error("Lỗi xảy ra khi declineRequest", error);
    } finally {
      set({ loading: false });
    }
  },
  getFriends: async () => {
    try {
      set({ loading: true });
      const friends = await friendService.getFriendList();
      set({ friends: friends });
    } catch (error) {
      console.error("Lỗi xảy ra khi load friends", error);
      set({ friends: [] });
    } finally {
      set({ loading: false });
    }
  },
}));
