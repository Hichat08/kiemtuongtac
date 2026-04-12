import type { UserNotificationSettings } from "@/types/user";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NotificationActivityPreferenceKey =
  | "newTasks"
  | "reviewStatus"
  | "balanceChanges";

export type NotificationSystemPreferenceKey = "adminMessages" | "promotions";

export const createDefaultNotificationSettings = (): UserNotificationSettings => ({
  activity: {
    newTasks: true,
    reviewStatus: true,
    balanceChanges: true,
  },
  system: {
    adminMessages: true,
    promotions: false,
  },
  emailDigest: false,
  pushEnabled: false,
});

type NotificationSettingsState = UserNotificationSettings & {
  hydratedAccountId: string | null;
  setActivityPreference: (
    key: NotificationActivityPreferenceKey,
    enabled: boolean
  ) => void;
  setSystemPreference: (
    key: NotificationSystemPreferenceKey,
    enabled: boolean
  ) => void;
  setEmailDigest: (enabled: boolean) => void;
  setPushEnabled: (enabled: boolean) => void;
  replaceSettings: (settings: UserNotificationSettings, accountId?: string | null) => void;
  resetSettings: () => void;
};

export const useNotificationSettingsStore = create<NotificationSettingsState>()(
  persist(
    (set) => ({
      ...createDefaultNotificationSettings(),
      hydratedAccountId: null,
      setActivityPreference: (key, enabled) =>
        set((state) => ({
          activity: {
            ...state.activity,
            [key]: enabled,
          },
        })),
      setSystemPreference: (key, enabled) =>
        set((state) => ({
          system: {
            ...state.system,
            [key]: enabled,
          },
        })),
      setEmailDigest: (enabled) => set({ emailDigest: enabled }),
      setPushEnabled: (enabled) => set({ pushEnabled: enabled }),
      replaceSettings: (settings, accountId = null) =>
        set(() => {
          const defaults = createDefaultNotificationSettings();

          return {
            ...defaults,
            ...settings,
            activity: {
              ...defaults.activity,
              ...settings.activity,
            },
            system: {
              ...defaults.system,
              ...settings.system,
            },
            hydratedAccountId: accountId,
          };
        }),
      resetSettings: () =>
        set({
          ...createDefaultNotificationSettings(),
          hydratedAccountId: null,
        }),
    }),
    {
      name: "notification-settings-storage",
    }
  )
);
