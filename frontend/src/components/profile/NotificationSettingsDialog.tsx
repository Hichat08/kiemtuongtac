import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { userService } from "@/services/userService";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  type NotificationActivityPreferenceKey,
  type NotificationSystemPreferenceKey,
  useNotificationSettingsStore,
} from "@/stores/useNotificationSettingsStore";
import type { UpdateUserNotificationSettingsPayload } from "@/types/user";
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  Gift,
  Mail,
  Megaphone,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

interface NotificationSettingsDialogProps {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

type NotificationPermissionState = NotificationPermission | "unsupported";

type ToggleCardProps = {
  checked: boolean;
  description: string;
  disabled?: boolean;
  icon: typeof Bell;
  iconClassName: string;
  onCheckedChange: (checked: boolean) => void;
  title: string;
};

type ToggleOption<T extends string> = {
  key: T;
  title: string;
  description: string;
  icon: typeof Bell;
  iconClassName: string;
};

const activityOptions: ToggleOption<NotificationActivityPreferenceKey>[] = [
  {
    key: "newTasks",
    title: "Nhiệm vụ mới",
    description: "Nhận thông báo khi có nhiệm vụ hái ra tiền mới",
    icon: Bell,
    iconClassName: "bg-[#f3edff] text-[#7b19d8]",
  },
  {
    key: "reviewStatus",
    title: "Trạng thái duyệt",
    description: "Thông báo khi nhiệm vụ được duyệt hoặc bị từ chối",
    icon: BadgeCheck,
    iconClassName: "bg-[#006574]/10 text-[#006574]",
  },
  {
    key: "balanceChanges",
    title: "Biến động số dư",
    description: "Nhận thông báo khi tiền về ví hoặc phát sinh giao dịch",
    icon: Wallet,
    iconClassName: "bg-[#0846ed]/10 text-[#0846ed]",
  },
];

const systemOptions: ToggleOption<NotificationSystemPreferenceKey>[] = [
  {
    key: "adminMessages",
    title: "Tin nhắn từ quản trị",
    description: "Cập nhật quy định, thông báo chung và thay đổi hệ thống",
    icon: ShieldCheck,
    iconClassName: "bg-[#f0f0f5] text-[#5a5b5f]",
  },
  {
    key: "promotions",
    title: "Ưu đãi & Khuyến mãi",
    description: "Các sự kiện x2, x3 tiền thưởng và chiến dịch thưởng nóng",
    icon: Gift,
    iconClassName: "bg-[#f0f0f5] text-[#5a5b5f]",
  },
];

const NotificationToggleCard = ({
  checked,
  description,
  disabled = false,
  icon,
  iconClassName,
  onCheckedChange,
  title,
}: ToggleCardProps) => {
  const Icon = icon;

  return (
    <div className="flex items-center justify-between rounded-[1.2rem] bg-white px-4 py-4 shadow-[0_18px_42px_-34px_rgba(123,25,216,0.14)]">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex size-12 shrink-0 items-center justify-center rounded-full ${iconClassName}`}
        >
          <Icon className="size-5" />
        </div>

        <div className="min-w-0">
          <h4 className="font-auth-headline text-[1rem] font-bold tracking-[-0.03em] text-[#2d2f32]">
            {title}
          </h4>
          <p className="mt-1 text-xs leading-5 text-[#6b6d71]">{description}</p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={`relative ml-3 flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-[#7b19d8]" : "bg-[#d7dde0]"
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <span
          className={`block size-5 rounded-full bg-white shadow-[0_6px_16px_-8px_rgba(0,0,0,0.35)] transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
};

const getRequestErrorMessage = (error: unknown, fallback: string) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message ===
      "string"
  ) {
    const message = (error as { response?: { data?: { message?: string } } }).response?.data
      ?.message;

    if (message?.trim()) {
      return message;
    }
  }

  return fallback;
};

const NotificationSettingsDialog = ({
  open,
  setOpen,
}: NotificationSettingsDialogProps) => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const {
    activity,
    system,
    emailDigest,
    pushEnabled,
    replaceSettings,
    setActivityPreference,
    setSystemPreference,
    setEmailDigest,
    setPushEnabled,
  } = useNotificationSettingsStore();
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>("unsupported");
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [savingKeys, setSavingKeys] = useState<string[]>([]);
  const notificationSettingsScope = user?.accountId ?? user?._id ?? null;

  const markSaving = (key: string, isSaving: boolean) => {
    setSavingKeys((currentKeys) => {
      if (isSaving) {
        return currentKeys.includes(key) ? currentKeys : [...currentKeys, key];
      }

      return currentKeys.filter((item) => item !== key);
    });
  };

  const replaceNotificationSettings = (settings: {
    activity: typeof activity;
    system: typeof system;
    emailDigest: boolean;
    pushEnabled: boolean;
  }) => {
    replaceSettings(settings, notificationSettingsScope);
  };

  const persistNotificationSettings = async ({
    errorMessage,
    optimisticUpdate,
    payload,
    savingKey,
    successMessage,
  }: {
    errorMessage: string;
    optimisticUpdate: () => void;
    payload: UpdateUserNotificationSettingsPayload;
    savingKey: string;
    successMessage: string;
  }) => {
    const previousSettings = {
      activity: { ...activity },
      system: { ...system },
      emailDigest,
      pushEnabled,
    };

    optimisticUpdate();
    markSaving(savingKey, true);

    try {
      const data = await userService.updateNotificationSettings(payload);
      replaceSettings(data.settings, notificationSettingsScope);
      toast.success(successMessage);
    } catch (error) {
      replaceNotificationSettings(previousSettings);
      toast.error(getRequestErrorMessage(error, errorMessage));
    } finally {
      markSaving(savingKey, false);
    }
  };

  const isSyncing = isLoadingSettings || savingKeys.length > 0;
  const pushDeliveryEnabled = pushEnabled && notificationPermission === "granted";

  useEffect(() => {
    if (!open || user?.role !== "admin") {
      return;
    }

    setOpen(false);
    navigate("/admin");
  }, [navigate, open, setOpen, user?.role]);

  useEffect(() => {
    let active = true;

    if (!open || !user || user.role === "admin") {
      return () => {
        active = false;
      };
    }

    const syncNotificationSettings = async () => {
      setIsLoadingSettings(true);

      try {
        const data = await userService.getNotificationSettings();

        if (!active) {
          return;
        }

        replaceSettings(data.settings, notificationSettingsScope);
      } catch (error) {
        if (!active) {
          return;
        }

        toast.error(getRequestErrorMessage(error, "Không thể tải cài đặt thông báo."));
      } finally {
        if (active) {
          setIsLoadingSettings(false);
        }
      }
    };

    void syncNotificationSettings();

    return () => {
      active = false;
    };
  }, [notificationSettingsScope, open, replaceSettings, user, user?.role]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (typeof window === "undefined" || typeof Notification === "undefined") {
      setNotificationPermission("unsupported");
      return;
    }

    setNotificationPermission(Notification.permission);
  }, [open]);

  const activeToggleCount = useMemo(() => {
    const activityCount = Object.values(activity).filter(Boolean).length;
    const systemCount = Object.values(system).filter(Boolean).length;
    const deliveryCount = Number(emailDigest) + Number(pushDeliveryEnabled);

    return activityCount + systemCount + deliveryCount;
  }, [activity, emailDigest, pushDeliveryEnabled, system]);

  if (user?.role === "admin") {
    return null;
  }

  const handleActivityToggle = async (
    key: NotificationActivityPreferenceKey,
    checked: boolean
  ) => {
    await persistNotificationSettings({
      savingKey: `activity:${key}`,
      payload: {
        activity: {
          [key]: checked,
        },
      },
      optimisticUpdate: () => setActivityPreference(key, checked),
      successMessage: checked
        ? "Đã bật thông báo hoạt động."
        : "Đã tắt thông báo hoạt động.",
      errorMessage: "Không thể cập nhật thông báo hoạt động.",
    });
  };

  const handleSystemToggle = async (key: NotificationSystemPreferenceKey, checked: boolean) => {
    await persistNotificationSettings({
      savingKey: `system:${key}`,
      payload: {
        system: {
          [key]: checked,
        },
      },
      optimisticUpdate: () => setSystemPreference(key, checked),
      successMessage: checked
        ? "Đã bật thông báo hệ thống."
        : "Đã tắt thông báo hệ thống.",
      errorMessage: "Không thể cập nhật thông báo hệ thống.",
    });
  };

  const handlePushAction = async () => {
    if (notificationPermission === "unsupported") {
      if (pushEnabled) {
        await persistNotificationSettings({
          savingKey: "delivery:push",
          payload: { pushEnabled: false },
          optimisticUpdate: () => setPushEnabled(false),
          successMessage: "Đã tắt thông báo đẩy cho tài khoản này.",
          errorMessage: "Không thể cập nhật thông báo đẩy.",
        });
        return;
      }

      toast.error("Thiết bị hoặc trình duyệt này chưa hỗ trợ thông báo đẩy.");
      return;
    }

    if (notificationPermission === "denied") {
      if (pushEnabled) {
        await persistNotificationSettings({
          savingKey: "delivery:push",
          payload: { pushEnabled: false },
          optimisticUpdate: () => setPushEnabled(false),
          successMessage: "Đã tắt thông báo đẩy cho tài khoản này.",
          errorMessage: "Không thể cập nhật thông báo đẩy.",
        });
        return;
      }

      toast.error("Thông báo đẩy đang bị chặn. Hãy bật lại trong cài đặt trình duyệt.");
      return;
    }

    if (notificationPermission === "granted") {
      const nextValue = !pushEnabled;

      await persistNotificationSettings({
        savingKey: "delivery:push",
        payload: { pushEnabled: nextValue },
        optimisticUpdate: () => setPushEnabled(nextValue),
        successMessage: nextValue
          ? "Đã bật thông báo đẩy trên tài khoản này."
          : "Đã tắt thông báo đẩy cho tài khoản này.",
        errorMessage: "Không thể cập nhật thông báo đẩy.",
      });
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === "granted") {
        await persistNotificationSettings({
          savingKey: "delivery:push",
          payload: { pushEnabled: true },
          optimisticUpdate: () => setPushEnabled(true),
          successMessage: "Đã cấp quyền và bật thông báo đẩy.",
          errorMessage: "Không thể cập nhật thông báo đẩy.",
        });
        return;
      }

      if (permission === "denied") {
        toast.error("Bạn đã từ chối quyền thông báo đẩy.");
        return;
      }

      toast.info("Bạn chưa cấp quyền cho thông báo đẩy.");
    } catch (error) {
      console.error("Không yêu cầu được quyền thông báo đẩy", error);
      toast.error("Không thể thiết lập thông báo đẩy trên trình duyệt này.");
    }
  };

  const handleEmailDigest = async () => {
    const nextValue = !emailDigest;

    await persistNotificationSettings({
      savingKey: "delivery:email",
      payload: { emailDigest: nextValue },
      optimisticUpdate: () => setEmailDigest(nextValue),
      successMessage: nextValue
        ? `Đã bật email thông báo tới ${user?.email ?? "email tài khoản"}.`
        : "Đã tắt email thông báo.",
      errorMessage: "Không thể cập nhật email thông báo.",
    });
  };

  const pushButtonLabel =
    notificationPermission === "unsupported"
      ? pushEnabled
        ? "Tắt trên tài khoản"
        : "Không hỗ trợ"
      : notificationPermission === "denied"
        ? pushEnabled
          ? "Tắt trên tài khoản"
          : "Bị chặn"
        : pushEnabled && notificationPermission === "granted"
          ? "Đang bật"
          : "Bật ngay";

  const pushButtonClassName =
    pushEnabled && notificationPermission === "granted"
      ? "bg-gradient-primary text-white"
      : pushEnabled
        ? "bg-[#f3edff] text-[#7b19d8]"
        : notificationPermission === "denied" || notificationPermission === "unsupported"
          ? "bg-[#e1e2e8] text-[#6b6d71]"
          : "bg-[#f3edff] text-[#7b19d8]";

  const emailButtonLabel = emailDigest ? "Đã bật" : "Thiết lập";
  const emailButtonClassName = emailDigest
    ? "bg-[#f3edff] text-[#7b19d8]"
    : "bg-[#e1e2e8] text-[#6b6d71]";

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogContent
        showCloseButton={false}
        className="left-0 top-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-0 bg-[#f6f6fa] p-0 shadow-none sm:max-w-none"
      >
        <DialogTitle className="sr-only">Cài đặt thông báo</DialogTitle>

        <div className="min-h-dvh bg-[#f6f6fa] font-auth-body text-[#2d2f32]">
          <header className="sticky top-0 z-20 bg-[#f6f6fa]/92 backdrop-blur-xl">
            <div className="mobile-page-shell flex items-center pb-3 pt-5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mr-3 flex size-9 items-center justify-center rounded-full text-[#7b19d8] transition-colors hover:bg-[#f3edff] active:scale-95"
                aria-label="Quay lại"
              >
                <ArrowLeft className="size-5" />
              </button>
              <h1 className="font-auth-headline text-[1.15rem] font-bold tracking-tight text-[#7b19d8]">
                Cài đặt thông báo
              </h1>
            </div>
            <div className="h-px bg-[#f0f0f5]" />
          </header>

          <main className="mobile-page-shell pb-12 pt-7">
            <section className="mb-9">
              <h2 className="font-auth-headline text-[2.3rem] font-extrabold leading-[1.04] tracking-[-0.06em] text-[#2d2f32]">
                Quản lý <br />
                <span className="text-[#7b19d8]">Trải nghiệm</span>
              </h2>
              <p className="mt-4 max-w-sm text-[1rem] leading-7 text-[#5a5b5f]">
                Tùy chỉnh cách bạn nhận thông tin từ Social Tasks để không bỏ lỡ bất kỳ
                cơ hội hái ra tiền nào.
              </p>
              <div className="mt-4 inline-flex items-center rounded-full bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7b19d8] shadow-[0_12px_30px_-24px_rgba(123,25,216,0.32)]">
                {activeToggleCount} lựa chọn đang bật
              </div>
              {isLoadingSettings ? (
                <p className="mt-3 text-xs font-medium text-[#7b19d8]">
                  Đang đồng bộ cài đặt từ tài khoản của bạn...
                </p>
              ) : null}
            </section>

            <section className="mb-8">
              <h3 className="mb-4 px-1 text-[0.74rem] font-bold uppercase tracking-[0.22em] text-[#8b8e94]">
                Thông báo hoạt động
              </h3>
              <div className="space-y-3">
                {activityOptions.map((option) => (
                  <NotificationToggleCard
                    key={option.key}
                    checked={activity[option.key]}
                    description={option.description}
                    disabled={isSyncing}
                    icon={option.icon}
                    iconClassName={option.iconClassName}
                    onCheckedChange={(checked) => void handleActivityToggle(option.key, checked)}
                    title={option.title}
                  />
                ))}
              </div>
            </section>

            <section className="mb-8">
              <h3 className="mb-4 px-1 text-[0.74rem] font-bold uppercase tracking-[0.22em] text-[#8b8e94]">
                Thông báo hệ thống
              </h3>
              <div className="space-y-3 rounded-[1.5rem] bg-[#f0f0f5] p-3">
                {systemOptions.map((option) => (
                  <div
                    key={option.key}
                    className="rounded-[1.2rem] bg-white px-4 py-4 shadow-[0_18px_42px_-34px_rgba(123,25,216,0.1)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex size-11 shrink-0 items-center justify-center rounded-full ${option.iconClassName}`}
                        >
                          <option.icon className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-auth-headline text-[1rem] font-bold tracking-[-0.03em] text-[#2d2f32]">
                            {option.title}
                          </h4>
                          <p className="mt-1 text-xs leading-5 text-[#6b6d71]">
                            {option.description}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={system[option.key]}
                        disabled={isSyncing}
                        onClick={() => void handleSystemToggle(option.key, !system[option.key])}
                        className={`relative ml-2 flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                          system[option.key] ? "bg-[#7b19d8]" : "bg-[#d7dde0]"
                        } ${isSyncing ? "cursor-not-allowed opacity-60" : ""}`}
                      >
                        <span
                          className={`block size-5 rounded-full bg-white shadow-[0_6px_16px_-8px_rgba(0,0,0,0.35)] transition-transform ${
                            system[option.key] ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-10">
              <h3 className="mb-4 px-1 text-[0.74rem] font-bold uppercase tracking-[0.22em] text-[#8b8e94]">
                Phương thức nhận
              </h3>

              <div className="grid gap-4">
                <div className="rounded-[1.4rem] bg-white px-4 py-5 shadow-[0_18px_42px_-34px_rgba(123,25,216,0.14)]">
                  <Bell className="size-7 text-[#7b19d8]" />
                  <h4 className="mt-4 font-auth-headline text-[1rem] font-bold text-[#2d2f32]">
                    Thông báo đẩy
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-[#6b6d71]">
                    Push notification trực tiếp trên thiết bị của bạn.
                  </p>
                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={() => void handlePushAction()}
                    className={`mt-5 w-full rounded-full px-4 py-2.5 text-xs font-bold uppercase tracking-[0.16em] transition-transform active:scale-[0.99] ${pushButtonClassName} ${
                      isSyncing ? "cursor-not-allowed opacity-60" : ""
                    }`}
                  >
                    {pushButtonLabel}
                  </button>
                </div>

                <div className="rounded-[1.4rem] bg-white px-4 py-5 shadow-[0_18px_42px_-34px_rgba(123,25,216,0.14)]">
                  <Mail className="size-7 text-[#6b6d71]" />
                  <h4 className="mt-4 font-auth-headline text-[1rem] font-bold text-[#2d2f32]">
                    Email thông báo
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-[#6b6d71]">
                    Nhận email qua {user?.email ?? "email tài khoản"}. Các cập nhật quan trọng về
                    giao dịch và quản trị vẫn luôn được gửi để đảm bảo minh bạch cho tài khoản.
                  </p>
                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={() => void handleEmailDigest()}
                    className={`mt-5 w-full rounded-full px-4 py-2.5 text-xs font-bold uppercase tracking-[0.16em] transition-transform active:scale-[0.99] ${emailButtonClassName} ${
                      isSyncing ? "cursor-not-allowed opacity-60" : ""
                    }`}
                  >
                    {emailButtonLabel}
                  </button>
                </div>
              </div>
            </section>

            <section className="relative overflow-hidden rounded-[1.8rem] bg-gradient-primary px-6 py-7 text-white shadow-[0_26px_58px_-32px_rgba(123,25,216,0.34)]">
              <div className="pointer-events-none absolute -right-10 top-0 h-32 w-32 rounded-full bg-white/12 blur-2xl" />
              <div className="pointer-events-none absolute bottom-0 right-6 h-24 w-24 rounded-full bg-[#ff9dc4]/30 blur-2xl" />
              <div className="relative z-10 max-w-[15rem]">
                <Megaphone className="size-7 text-white/92" />
                <p className="mt-4 font-auth-headline text-[1.55rem] font-bold leading-[1.15] tracking-[-0.04em]">
                  Hãy để chúng tôi thông báo những cơ hội tốt nhất cho bạn.
                </p>
              </div>
            </section>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationSettingsDialog;
