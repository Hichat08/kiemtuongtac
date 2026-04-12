import { create } from "zustand";
import { persist } from "zustand/middleware";

type NotificationCenterState = {
  readTimestamps: Record<string, number>;
  markAllAsRead: (scopeKey: string, readAt?: number) => void;
};

export const useNotificationCenterStore = create<NotificationCenterState>()(
  persist(
    (set) => ({
      readTimestamps: {},
      markAllAsRead: (scopeKey, readAt) =>
        set((state) => ({
          readTimestamps: {
            ...state.readTimestamps,
            [scopeKey]: Math.max(
              state.readTimestamps[scopeKey] ?? 0,
              Number.isFinite(readAt) ? Number(readAt) : Date.now()
            ),
          },
        })),
    }),
    {
      name: "notification-center-storage",
    }
  )
);
