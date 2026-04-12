import { useUserFinancialData, type UserFinancialTimelineItem } from "@/hooks/useUserFinancialData";
import { userService } from "@/services/userService";
import { useAuthStore } from "@/stores/useAuthStore";
import { useFriendStore } from "@/stores/useFriendStore";
import { useNotificationCenterStore } from "@/stores/useNotificationCenterStore";
import {
  useNotificationSettingsStore,
  type NotificationActivityPreferenceKey,
  type NotificationSystemPreferenceKey,
} from "@/stores/useNotificationSettingsStore";
import type {
  FriendRequest,
  UserBroadcastNotification,
  User,
  UserNotificationSettings,
} from "@/types/user";
import {
  ArrowDownToLine,
  Clock3,
  Gift,
  Megaphone,
  Sparkles,
  TriangleAlert,
  UserPlus,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type UserNotificationAction = "wallet" | "tasks" | "friend_requests" | "support" | "none";
type UserNotificationDeliveryPreference =
  | "always"
  | NotificationActivityPreferenceKey
  | NotificationSystemPreferenceKey;

export type UserNotificationItem = {
  id: string;
  action: UserNotificationAction;
  createdAtMs: number;
  deliveryPreference: UserNotificationDeliveryPreference;
  description: string;
  detailLabel?: string;
  detailText?: string;
  icon: LucideIcon;
  iconClassName: string;
  iconWrapClassName: string;
  isUnread: boolean;
  priorityLabel?: string;
  priorityClassName?: string;
  showAccent: boolean;
  timeLabel: string;
  title: string;
};

const RECENT_NOTIFICATION_WINDOW_MS = 8 * 60 * 60 * 1000;
const NOTIFICATION_POLL_INTERVAL_MS = 30_000;
const SHARED_NOTIFICATION_FRESHNESS_MS = 10_000;
const BROWSER_NOTIFICATION_STORAGE_PREFIX = "user-browser-notification-last-shown";

type NotificationCacheEntry<T> = {
  data: T;
  fetchedAt: number;
};

const notificationSettingsCache = new Map<string, NotificationCacheEntry<UserNotificationSettings>>();
const notificationSettingsInflight = new Map<string, Promise<UserNotificationSettings>>();
const broadcastCache = new Map<string, NotificationCacheEntry<UserBroadcastNotification[]>>();
const broadcastInflight = new Map<string, Promise<UserBroadcastNotification[]>>();

const formatCurrency = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const normalizeNotificationText = (value?: string | null) => `${value ?? ""}`.trim();

const hasFreshNotificationCache = <T,>(entry?: NotificationCacheEntry<T>) =>
  Boolean(entry && Date.now() - entry.fetchedAt < SHARED_NOTIFICATION_FRESHNESS_MS);

const getCachedBroadcasts = (scopeKey: string | null) => {
  if (!scopeKey) {
    return [];
  }

  return broadcastCache.get(scopeKey)?.data ?? [];
};

const fetchNotificationSettingsWithCache = async (scopeKey: string) => {
  const cachedEntry = notificationSettingsCache.get(scopeKey);
  if (cachedEntry && hasFreshNotificationCache(cachedEntry)) {
    return cachedEntry.data;
  }

  const inflightRequest = notificationSettingsInflight.get(scopeKey);
  if (inflightRequest) {
    return inflightRequest;
  }

  const request = userService.getNotificationSettings()
    .then((response) => {
      notificationSettingsCache.set(scopeKey, {
        data: response.settings,
        fetchedAt: Date.now(),
      });

      return response.settings;
    })
    .finally(() => {
      notificationSettingsInflight.delete(scopeKey);
    });

  notificationSettingsInflight.set(scopeKey, request);
  return request;
};

const fetchBroadcastsWithCache = async (scopeKey: string) => {
  const cachedEntry = broadcastCache.get(scopeKey);
  if (cachedEntry && hasFreshNotificationCache(cachedEntry)) {
    return cachedEntry.data;
  }

  const inflightRequest = broadcastInflight.get(scopeKey);
  if (inflightRequest) {
    return inflightRequest;
  }

  const request = userService.getBroadcastNotifications()
    .then((response) => {
      broadcastCache.set(scopeKey, {
        data: response.notifications,
        fetchedAt: Date.now(),
      });

      return response.notifications;
    })
    .finally(() => {
      broadcastInflight.delete(scopeKey);
    });

  broadcastInflight.set(scopeKey, request);
  return request;
};

const parseIsoDate = (value?: string | null) => {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const formatNotificationTime = (timestamp: number) => {
  if (!timestamp) {
    return "Vừa xong";
  }

  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) {
    return "Vừa xong";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} phút trước`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} giờ trước`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    return "Hôm qua";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(timestamp));
};

const getRecentNotificationCutoff = () => Date.now() - RECENT_NOTIFICATION_WINDOW_MS;

const matchesDeliveryPreference = (
  preference: UserNotificationDeliveryPreference,
  activity: Record<NotificationActivityPreferenceKey, boolean>,
  system: Record<NotificationSystemPreferenceKey, boolean>
) => {
  if (preference === "always") {
    return true;
  }

  if (preference in activity) {
    return activity[preference as NotificationActivityPreferenceKey];
  }

  return system[preference as NotificationSystemPreferenceKey];
};

const getBroadcastVisual = (type: UserBroadcastNotification["type"]) => {
  switch (type) {
    case "promotion":
      return {
        icon: Gift,
        iconClassName: "text-[#d4525d]",
        iconWrapClassName: "bg-[#fff0f5]",
        priorityLabel: "Ưu đãi",
        priorityClassName: "text-[#d4525d]",
      };
    case "warning":
      return {
        icon: TriangleAlert,
        iconClassName: "text-[#b31b25]",
        iconWrapClassName: "bg-[#fff0f2]",
        priorityLabel: "Cần lưu ý",
        priorityClassName: "text-[#b31b25]",
      };
    case "task":
      return {
        icon: Sparkles,
        iconClassName: "text-[#7b19d8]",
        iconWrapClassName: "bg-[#f3edff]",
        priorityLabel: "Nhiệm vụ",
        priorityClassName: "text-[#7b19d8]",
      };
    default:
      return {
        icon: Megaphone,
        iconClassName: "text-[#d97706]",
        iconWrapClassName: "bg-[#fff2e2]",
        priorityLabel: "Hệ thống",
        priorityClassName: "text-[#d97706]",
      };
  }
};

const buildUserNotificationItems = ({
  transactions,
  receivedList,
  broadcasts,
  lastReadAt,
  moderationUser,
}: {
  transactions: UserFinancialTimelineItem[];
  receivedList: FriendRequest[];
  broadcasts: UserBroadcastNotification[];
  lastReadAt: number;
  moderationUser?: User | null;
}) => {
  const dynamicNotifications: UserNotificationItem[] = [];

  dynamicNotifications.push(
    ...transactions.map((transaction) => {
      const isDeposit = transaction.kind === "deposit";
      const isAdjustment = transaction.kind === "adjustment";
      const isApproved = transaction.status === "approved";
      const isRejected = transaction.status === "rejected";
      const isPending = transaction.status === "pending";
      const isCredit = transaction.direction === "credit";
      const title = transaction.title;
      const normalizedTitle = title.toLowerCase();
      const isInternalTransfer =
        !isDeposit &&
        (normalizedTitle.includes("chuyển tiền nội bộ") || normalizedTitle.includes("chuyển nội bộ"));
      const detailText = normalizeNotificationText(transaction.detail);
      const detailLabel = isRejected
        ? "Lý do xử lý"
        : isAdjustment
          ? "Ghi chú hệ thống"
          : isPending
            ? "Chi tiết yêu cầu"
            : "Chi tiết giao dịch";

      const description = isAdjustment
        ? `Số tiền ${isCredit ? "được cộng" : "được trừ"} là ${formatCurrency(transaction.amount)}đ.`
        : isApproved
          ? isDeposit
            ? `Ví của bạn vừa được cộng ${formatCurrency(transaction.amount)}đ.`
            : isInternalTransfer
              ? `Khoản chuyển tiền nội bộ ${formatCurrency(transaction.amount)}đ đã hoàn tất.`
              : `Yêu cầu rút ${formatCurrency(transaction.amount)}đ của bạn đã được duyệt thành công.`
          : isRejected
            ? `Yêu cầu ${isDeposit ? "nạp" : isInternalTransfer ? "chuyển tiền nội bộ" : "rút"} ${formatCurrency(transaction.amount)}đ chưa được chấp nhận.`
            : `${isDeposit ? "Khoản nạp" : isInternalTransfer ? "Khoản chuyển tiền nội bộ" : "Khoản rút"} ${formatCurrency(transaction.amount)}đ đang chờ duyệt.`;

      return {
        id: `transaction-${transaction.id}`,
        action: "wallet" as const,
        createdAtMs: transaction.createdAtMs,
        deliveryPreference: "balanceChanges" as const,
        description,
        detailLabel: detailText ? detailLabel : undefined,
        detailText: detailText || undefined,
        icon: isAdjustment
          ? isCredit
            ? Wallet
            : XCircle
          : isApproved
            ? isDeposit
              ? ArrowDownToLine
              : Wallet
            : isRejected
              ? XCircle
              : Clock3,
        iconClassName: isApproved
          ? isAdjustment
            ? isCredit
              ? "text-[#006945]"
              : "text-[#d17b00]"
            : isDeposit
              ? "text-[#0846ed]"
              : "text-[#006945]"
          : isRejected
            ? "text-[#b31b25]"
            : "text-[#7b19d8]",
        iconWrapClassName: isApproved
          ? isAdjustment
            ? isCredit
              ? "bg-[#e7fbf2]"
              : "bg-[#fff5ea]"
            : isDeposit
              ? "bg-[#e8efff]"
              : "bg-[#e7fbf2]"
          : isRejected
            ? "bg-[#fff0f2]"
            : "bg-[#f3edff]",
        isUnread: transaction.createdAtMs > lastReadAt,
        priorityLabel: isApproved ? undefined : isPending ? "Chờ duyệt" : "Cần kiểm tra",
        priorityClassName: isPending
          ? "text-[#0846ed]"
          : isRejected
            ? "text-[#b31b25]"
            : undefined,
        showAccent: transaction.createdAtMs > lastReadAt,
        timeLabel: formatNotificationTime(transaction.createdAtMs),
        title,
      };
    })
  );

  dynamicNotifications.push(
    ...receivedList.slice(0, 6).map((request) => {
      const createdAtMs = parseIsoDate(request.createdAt);
      const senderName = request.from?.displayName ?? request.from?.username ?? "Một người dùng";

      return {
        id: `friend-request-${request._id}`,
        action: "friend_requests" as const,
        createdAtMs,
        deliveryPreference: "always" as const,
        description: `${senderName} vừa gửi lời mời kết bạn cho bạn. Mở để xem và phản hồi ngay.`,
        icon: UserPlus,
        iconClassName: "text-[#7b19d8]",
        iconWrapClassName: "bg-[#f3edff]",
        isUnread: createdAtMs > lastReadAt,
        priorityLabel: "Kết nối mới",
        priorityClassName: "text-[#7b19d8]",
        showAccent: createdAtMs > lastReadAt,
        timeLabel: formatNotificationTime(createdAtMs),
        title: "Lời mời kết bạn mới",
      };
    })
  );

  dynamicNotifications.push(
    ...broadcasts.map((broadcast) => {
      const createdAtMs = parseIsoDate(broadcast.sentAt ?? broadcast.createdAt);
      const visual = getBroadcastVisual(broadcast.type);

      return {
        id: `broadcast-${broadcast.id}`,
        action: "none" as const,
        createdAtMs,
        deliveryPreference: (broadcast.type === "promotion"
          ? "promotions"
          : "adminMessages") as UserNotificationDeliveryPreference,
        description: broadcast.content,
        icon: visual.icon,
        iconClassName: visual.iconClassName,
        iconWrapClassName: visual.iconWrapClassName,
        isUnread: createdAtMs > lastReadAt,
        priorityLabel: visual.priorityLabel,
        priorityClassName: visual.priorityClassName,
        showAccent: createdAtMs > lastReadAt,
        timeLabel: formatNotificationTime(createdAtMs),
        title: broadcast.title,
      };
    })
  );

  if (moderationUser?.moderationStatus === "warned") {
    const warnedAtMs = parseIsoDate(moderationUser.lastWarnedAt ?? moderationUser.updatedAt);
    const warningCount = Math.max(moderationUser.warningCount ?? 1, 1);
    const moderationReason =
      normalizeNotificationText(moderationUser.moderationNote) ||
      "Tài khoản của bạn đang bị cảnh cáo và cần lưu ý các quy định vận hành của hệ thống.";

    dynamicNotifications.push({
      id: `moderation-warning-${moderationUser._id}-${moderationUser.lastWarnedAt ?? moderationUser.updatedAt ?? "current"}`,
      action: "support",
      createdAtMs: warnedAtMs,
      deliveryPreference: "adminMessages",
      description: "Tài khoản của bạn vừa nhận cảnh cáo mới từ quản trị hệ thống.",
      detailLabel: "Lý do cảnh cáo",
      detailText: moderationReason,
      icon: TriangleAlert,
      iconClassName: "text-[#b31b25]",
      iconWrapClassName: "bg-[#fff0f2]",
      isUnread: warnedAtMs > lastReadAt,
      priorityLabel: `Cảnh cáo lần ${warningCount}`,
      priorityClassName: "text-[#b31b25]",
      showAccent: true,
      timeLabel: formatNotificationTime(warnedAtMs),
      title: "Cảnh cáo từ quản trị hệ thống",
    });
  }

  const uniqueNotifications = new Map<string, UserNotificationItem>();

  dynamicNotifications.forEach((item) => {
    const existingItem = uniqueNotifications.get(item.id);

    if (!existingItem || existingItem.createdAtMs < item.createdAtMs) {
      uniqueNotifications.set(item.id, item);
    }
  });

  return Array.from(uniqueNotifications.values()).sort(
    (left, right) => right.createdAtMs - left.createdAtMs
  );
};

export function useUserNotificationSummary() {
  const { user } = useAuthStore();
  const { transactions } = useUserFinancialData(user?.accountId);
  const { receivedList, getAllFriendRequests } = useFriendStore();
  const {
    activity,
    system,
    pushEnabled,
    hydratedAccountId,
    replaceSettings,
  } = useNotificationSettingsStore();
  const notificationScopeKey = user?.accountId ?? user?._id ?? null;
  const [broadcasts, setBroadcasts] = useState<UserBroadcastNotification[]>(() =>
    getCachedBroadcasts(notificationScopeKey)
  );
  const scopeKey = notificationScopeKey ?? "guest";
  const lastReadAt = useNotificationCenterStore((state) => state.readTimestamps[scopeKey] ?? 0);
  const notificationSettingsAccountId = notificationScopeKey;

  useEffect(() => {
    if (!notificationScopeKey || user?.role === "admin") {
      setBroadcasts([]);
      return;
    }

    setBroadcasts(getCachedBroadcasts(notificationScopeKey));
  }, [notificationScopeKey, user?.role]);

  useEffect(() => {
    let active = true;

    if (
      !notificationSettingsAccountId ||
      !user ||
      user.role === "admin" ||
      hydratedAccountId === notificationSettingsAccountId
    ) {
      return () => {
        active = false;
      };
    }

    const syncNotificationSettings = async () => {
      try {
        const settings = await fetchNotificationSettingsWithCache(notificationSettingsAccountId);

        if (!active) {
          return;
        }

        replaceSettings(settings, notificationSettingsAccountId);
      } catch (error) {
        console.error("Không tải được cài đặt thông báo của user", error);
      }
    };

    void syncNotificationSettings();

    return () => {
      active = false;
    };
  }, [
    hydratedAccountId,
    notificationSettingsAccountId,
    replaceSettings,
    user,
    user?.role,
  ]);

  useEffect(() => {
    let active = true;

    if (!user || user.role === "admin") {
      return () => {
        active = false;
      };
    }

    const syncFriendRequests = async () => {
      try {
        await getAllFriendRequests();
      } catch (error) {
        console.error("Không đồng bộ được lời mời kết bạn cho notification", error);
      }
    };

    void syncFriendRequests();

    const handleWindowFocus = () => {
      if (!active) {
        return;
      }

      void syncFriendRequests();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncFriendRequests();
      }
    };

    const intervalId = window.setInterval(() => {
      void syncFriendRequests();
    }, NOTIFICATION_POLL_INTERVAL_MS);

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [getAllFriendRequests, user?._id, user?.role]);

  useEffect(() => {
    let active = true;

    if (!user || user.role === "admin" || !notificationScopeKey) {
      setBroadcasts([]);
      return () => {
        active = false;
      };
    }

    const syncBroadcasts = async () => {
      try {
        const notifications = await fetchBroadcastsWithCache(notificationScopeKey);

        if (!active) {
          return;
        }

        setBroadcasts(notifications);
      } catch (error) {
        console.error("Không tải được broadcast notification cho user", error);

        if (!active) {
          return;
        }

        setBroadcasts(getCachedBroadcasts(notificationScopeKey));
      }
    };

    const handleWindowFocus = () => {
      void syncBroadcasts();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncBroadcasts();
      }
    };

    void syncBroadcasts();

    const intervalId = window.setInterval(() => {
      void syncBroadcasts();
    }, NOTIFICATION_POLL_INTERVAL_MS);

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [notificationScopeKey, user?._id, user?.role]);

  const notificationItems = useMemo(() => {
    if (user?.role === "admin") {
      return [];
    }

    return buildUserNotificationItems({
      transactions,
      receivedList,
      broadcasts,
      lastReadAt,
      moderationUser: user,
    });
  }, [broadcasts, lastReadAt, receivedList, transactions, user]);

  useEffect(() => {
    if (
      !user ||
      user.role === "admin" ||
      !pushEnabled ||
      typeof window === "undefined" ||
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    ) {
      return;
    }

    const storageKey = `${BROWSER_NOTIFICATION_STORAGE_PREFIX}:${scopeKey}`;
    const storedValue = window.sessionStorage.getItem(storageKey);
    const lastShownAt = Number(storedValue ?? 0);

    const nextItems = notificationItems
      .filter(
        (item) =>
          item.isUnread &&
          item.createdAtMs > lastShownAt &&
          matchesDeliveryPreference(item.deliveryPreference, activity, system)
      )
      .sort((left, right) => left.createdAtMs - right.createdAtMs)
      .slice(-3);

    if (!nextItems.length) {
      return;
    }

    nextItems.forEach((item) => {
      try {
        const notification = new Notification(item.title, {
          body: item.detailText
            ? `${item.description} ${item.detailLabel ?? "Chi tiết"}: ${item.detailText}`
            : item.description,
          tag: `ktt-${item.id}`,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (error) {
        console.error("Không hiển thị được browser notification", error);
      }
    });

    const latestTimestamp = Math.max(...nextItems.map((item) => item.createdAtMs));
    window.sessionStorage.setItem(storageKey, String(latestTimestamp));
  }, [activity, notificationItems, pushEnabled, scopeKey, system, user?._id, user?.role]);

  return useMemo(() => {
    const recentCutoff = getRecentNotificationCutoff();
    const recentNotifications = notificationItems.filter((item) => item.createdAtMs >= recentCutoff);
    const earlierNotifications = notificationItems.filter((item) => item.createdAtMs < recentCutoff);
    const unreadCount = notificationItems.filter((item) => item.isUnread).length;
    const recentUnreadCount = recentNotifications.filter((item) => item.isUnread).length;

    return {
      scopeKey,
      notificationItems,
      recentNotifications,
      earlierNotifications,
      unreadCount,
      recentUnreadCount,
    };
  }, [notificationItems, scopeKey]);
}
