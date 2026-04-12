import AdminShell from "@/components/admin/AdminShell";
import {
  ADMIN_COMMUNITY_GIFT_DRAFT_KEY,
  COMMUNITY_GIFT_MESSAGE_MAX_LENGTH,
  COMMUNITY_GIFT_PRESET_AMOUNTS,
  COMMUNITY_GIFT_RECIPIENT_MAX,
  COMMUNITY_GIFT_TRACKING_OPTIONS,
  DEFAULT_COMMUNITY_GIFT_MESSAGE,
  clampPositiveInteger,
  formatCurrency,
  formatNumber,
  isCommunityConversation,
} from "@/lib/admin-community";
import { cn } from "@/lib/utils";
import { useUserFinancialData } from "@/hooks/useUserFinancialData";
import { chatService } from "@/services/chatService";
import { useAuthStore } from "@/stores/useAuthStore";
import type { Conversation } from "@/types/chat";
import axios from "axios";
import {
  ArrowLeft,
  Gift,
  SendHorizontal,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type DistributionMode = "random" | "equal";
type TrackingWindow =
  (typeof COMMUNITY_GIFT_TRACKING_OPTIONS)[number]["value"];

interface CommunityGiftDraft {
  campaignTitle: string;
  trackingWindow: TrackingWindow;
  note: string;
  totalAmount: string;
  recipientCount: string;
  distributionMode: DistributionMode;
}

const createDefaultDraft = (): CommunityGiftDraft => ({
  campaignTitle: "",
  trackingWindow: "24h",
  note: DEFAULT_COMMUNITY_GIFT_MESSAGE,
  totalAmount: "",
  recipientCount: "10",
  distributionMode: "random",
});

const getErrorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? error.response?.data?.message ?? fallback : fallback;

const parsePositiveNumericText = (value: string) =>
  Number.parseInt(value.replace(/[^\d]/g, ""), 10) || 0;

export default function AdminCommunityGiftCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentBalance, refresh: refreshFinancialData } = useUserFinancialData(
    user?.accountId
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [communityConversation, setCommunityConversation] =
    useState<Conversation | null>(null);
  const [draft, setDraft] = useState<CommunityGiftDraft>(createDefaultDraft);
  const [loadingConversation, setLoadingConversation] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    const loadCommunityConversation = async () => {
      try {
        setLoadingConversation(true);
        const res = await chatService.fetchConversations();
        const targetConversation =
          res.conversations.find((conversation) =>
            isCommunityConversation(conversation)
          ) ?? null;

        if (!active) {
          return;
        }

        setCommunityConversation(targetConversation);
      } catch (error) {
        console.error("Không tải được phòng cộng đồng để tạo lì xì", error);

        if (!active) {
          return;
        }

        toast.error(getErrorMessage(error, "Không tải được phòng cộng đồng."));
      } finally {
        if (active) {
          setLoadingConversation(false);
        }
      }
    };

    const draftRaw =
      typeof window !== "undefined"
        ? window.localStorage.getItem(ADMIN_COMMUNITY_GIFT_DRAFT_KEY)
        : null;

    if (draftRaw) {
      try {
        const parsed = JSON.parse(draftRaw) as Partial<CommunityGiftDraft>;
        setDraft((current) => ({ ...current, ...parsed }));
      } catch (error) {
        console.error("Không đọc được bản nháp lì xì cộng đồng", error);
      }
    }

    void loadCommunityConversation();

    return () => {
      active = false;
    };
  }, []);

  const totalAmount = parsePositiveNumericText(draft.totalAmount);
  const recipientCount = clampPositiveInteger(
    parsePositiveNumericText(draft.recipientCount),
    1,
    COMMUNITY_GIFT_RECIPIENT_MAX
  );
  const averageAmount =
    recipientCount > 0 ? Math.floor(totalAmount / recipientCount) : 0;
  const notePreview = draft.note.trim() || DEFAULT_COMMUNITY_GIFT_MESSAGE;
  const titlePreview = draft.campaignTitle.trim() || "Lì xì cộng đồng mới";
  const trackingLabel =
    COMMUNITY_GIFT_TRACKING_OPTIONS.find(
      (option) => option.value === draft.trackingWindow
    )?.label ?? "24 Giờ";
  const balanceEnough = currentBalance >= totalAmount;
  const validRecipientBudget = totalAmount >= recipientCount;
  const submitDisabled =
    submitting ||
    loadingConversation ||
    !communityConversation ||
    totalAmount <= 0 ||
    !balanceEnough ||
    !validRecipientBudget ||
    draft.distributionMode !== "random";

  const previewMeta = useMemo(
    () => ({
      totalAmountLabel: totalAmount > 0 ? formatCurrency(totalAmount) : "0đ",
      recipientLabel: `${formatNumber(recipientCount)} người`,
      averageLabel:
        averageAmount > 0 ? formatCurrency(averageAmount) : "0đ / người",
    }),
    [averageAmount, recipientCount, totalAmount]
  );

  const updateDraft = <K extends keyof CommunityGiftDraft>(
    key: K,
    value: CommunityGiftDraft[K]
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSaveDraft = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      ADMIN_COMMUNITY_GIFT_DRAFT_KEY,
      JSON.stringify(draft)
    );
    toast.success("Đã lưu bản nháp tạo lì xì.");
  };

  const handleSubmit = async () => {
    if (!communityConversation) {
      toast.error("Chưa tìm thấy phòng cộng đồng để phát lì xì.");
      return;
    }

    if (draft.distributionMode !== "random") {
      toast.info("Phiên bản hiện tại mới hỗ trợ phát lì xì ngẫu nhiên.");
      return;
    }

    if (!balanceEnough) {
      toast.error("Số dư ví admin hiện tại chưa đủ để phát lì xì.");
      return;
    }

    if (!validRecipientBudget) {
      toast.error("Tổng ngân sách phải lớn hơn hoặc bằng số lượng người nhận.");
      return;
    }

    try {
      setSubmitting(true);
      await chatService.sendGroupMessage(communityConversation._id, "", undefined, {
        amount: totalAmount,
        recipientCount,
        message: notePreview,
      });
      await refreshFinancialData();

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(ADMIN_COMMUNITY_GIFT_DRAFT_KEY);
      }

      toast.success("Đã tạo lì xì mới trong phòng cộng đồng.");
      navigate("/admin/community");
    } catch (error) {
      console.error("Không gửi được lì xì cộng đồng", error);
      toast.error(getErrorMessage(error, "Không tạo được lì xì cộng đồng."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminShell
      title="Tạo Bao Lì Xì"
      subtitle="Khởi tạo quà tặng tài chính cho phòng cộng đồng và xem trước trước khi phát."
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Tìm chiến dịch, lời nhắn hoặc lịch sử lì xì..."
      action={
        <button
          type="button"
          onClick={() => navigate("/admin/community")}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#f3edff] px-6 text-sm font-bold text-[#7b19d8] transition-colors hover:bg-[#ece3ff]"
        >
          <ArrowLeft className="size-4.5" />
          Quay lại cộng đồng
        </button>
      }
      sidebarActionLabel="Về cộng đồng"
      onSidebarActionClick={() => navigate("/admin/community")}
    >
      <section className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-[#e9f8ef] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#00a46f]">
          Chiến dịch mới
        </span>
        <button
          type="button"
          onClick={() => navigate("/admin/community")}
          className="rounded-full bg-[#faf8ff] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#7a8190]"
        >
          Lịch sử
        </button>
        <button
          type="button"
          onClick={() => navigate("/admin/community")}
          className="rounded-full bg-[#faf8ff] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#7a8190]"
        >
          Báo cáo
        </button>
      </section>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_420px]">
        <div className="rounded-[1.7rem] bg-white p-6 shadow-[0_24px_55px_-38px_rgba(45,47,50,0.14)] sm:p-8">
          <div>
            <h2 className="font-auth-headline text-[2.4rem] font-extrabold tracking-[-0.05em] text-[#2d2f32] sm:text-[3.2rem]">
              Tạo Bao Lì Xì Cộng Đồng Mới
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-[#6c7281]">
              Mẫu này phát quà trực tiếp vào phòng cộng đồng bằng số dư ví admin.
              Tên chiến dịch và thời gian theo dõi đang được dùng để quản trị nội
              bộ trong panel.
            </p>
          </div>

          <div className="mt-10 space-y-8">
            <div className="grid gap-6 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="ml-1 text-xs font-bold uppercase tracking-[0.14em] text-[#8f96a4]">
                  Tên chiến dịch quà tặng
                </span>
                <input
                  value={draft.campaignTitle}
                  onChange={(event) =>
                    updateDraft("campaignTitle", event.target.value.slice(0, 60))
                  }
                  placeholder="Ví dụ: Lì xì cuối tuần"
                  className="h-14 rounded-[1rem] border-0 bg-[#faf8ff] px-5 text-sm font-medium text-[#2d2f32] outline-none ring-2 ring-transparent transition-all focus:bg-white focus:ring-[#7b19d8]/20"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="ml-1 text-xs font-bold uppercase tracking-[0.14em] text-[#8f96a4]">
                  Thời gian theo dõi
                </span>
                <select
                  value={draft.trackingWindow}
                  onChange={(event) =>
                    updateDraft(
                      "trackingWindow",
                      event.target.value as TrackingWindow
                    )
                  }
                  className="h-14 rounded-[1rem] border-0 bg-[#faf8ff] px-5 text-sm font-medium text-[#2d2f32] outline-none ring-2 ring-transparent transition-all focus:bg-white focus:ring-[#7b19d8]/20"
                >
                  {COMMUNITY_GIFT_TRACKING_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-2">
              <span className="ml-1 text-xs font-bold uppercase tracking-[0.14em] text-[#8f96a4]">
                Lời nhắn kèm theo
              </span>
              <div className="relative">
                <textarea
                  value={draft.note}
                  onChange={(event) =>
                    updateDraft(
                      "note",
                      event.target.value.slice(0, COMMUNITY_GIFT_MESSAGE_MAX_LENGTH)
                    )
                  }
                  rows={4}
                  placeholder={DEFAULT_COMMUNITY_GIFT_MESSAGE}
                  className="min-h-[128px] w-full rounded-[1rem] border-0 bg-[#faf8ff] px-5 py-4 text-sm leading-7 text-[#2d2f32] outline-none ring-2 ring-transparent transition-all focus:bg-white focus:ring-[#7b19d8]/20"
                />
                <span className="absolute bottom-4 right-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a1a8b4]">
                  {draft.note.length}/{COMMUNITY_GIFT_MESSAGE_MAX_LENGTH}
                </span>
              </div>
            </label>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                {COMMUNITY_GIFT_PRESET_AMOUNTS.map((amount) => {
                  const selected = totalAmount === amount;

                  return (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => updateDraft("totalAmount", String(amount))}
                      className={cn(
                        "rounded-full px-4 py-2 text-xs font-bold transition-colors",
                        selected
                          ? "bg-[#e9f8ef] text-[#00a46f]"
                          : "bg-[#faf8ff] text-[#7a8190]"
                      )}
                    >
                      {formatCurrency(amount)}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-6 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="ml-1 text-xs font-bold uppercase tracking-[0.14em] text-[#8f96a4]">
                    Tổng ngân sách (VND)
                  </span>
                  <div className="relative">
                    <input
                      inputMode="numeric"
                      value={draft.totalAmount}
                      onChange={(event) =>
                        updateDraft(
                          "totalAmount",
                          event.target.value.replace(/[^\d]/g, "")
                        )
                      }
                      placeholder="0"
                      className="h-18 w-full rounded-[1rem] border-0 bg-[#faf8ff] px-5 pr-16 font-auth-headline text-[2rem] font-extrabold tracking-[-0.04em] text-[#00a46f] outline-none ring-2 ring-transparent transition-all focus:bg-white focus:ring-[#7b19d8]/20"
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#8f96a4]">
                      VND
                    </span>
                  </div>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="ml-1 text-xs font-bold uppercase tracking-[0.14em] text-[#8f96a4]">
                    Số lượng bao lì xì
                  </span>
                  <input
                    inputMode="numeric"
                    value={draft.recipientCount}
                    onChange={(event) =>
                      updateDraft(
                        "recipientCount",
                        event.target.value.replace(/[^\d]/g, "")
                      )
                    }
                    placeholder="10"
                    className="h-18 w-full rounded-[1rem] border-0 bg-[#faf8ff] px-5 font-auth-headline text-[2rem] font-extrabold tracking-[-0.04em] text-[#2d2f32] outline-none ring-2 ring-transparent transition-all focus:bg-white focus:ring-[#7b19d8]/20"
                  />
                </label>
              </div>
            </div>

            <section className="rounded-[1.5rem] bg-[#f5f1fb] p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="font-auth-headline text-xl font-bold text-[#2d2f32]">
                    Chế độ phân phối
                  </h3>
                  <p className="mt-1 text-sm text-[#7a8190]">
                    Backend hiện hỗ trợ mở quà ngẫu nhiên. Chia đều sẽ được nối
                    sau.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-full bg-white p-1">
                  <button
                    type="button"
                    onClick={() => updateDraft("distributionMode", "random")}
                    className={cn(
                      "rounded-full px-5 py-3 text-sm font-bold transition-colors",
                      draft.distributionMode === "random"
                        ? "bg-[#e9f8ef] text-[#00a46f]"
                        : "text-[#7a8190]"
                    )}
                  >
                    Ngẫu nhiên
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateDraft("distributionMode", "equal");
                      toast.info("Chế độ chia đều chưa được backend hỗ trợ.");
                    }}
                    className={cn(
                      "rounded-full px-5 py-3 text-sm font-bold transition-colors",
                      draft.distributionMode === "equal"
                        ? "bg-[#fff4f1] text-[#d4525d]"
                        : "text-[#7a8190]"
                    )}
                  >
                    Chia đều
                  </button>
                </div>
              </div>
            </section>

            <section className="grid gap-4 rounded-[1.5rem] bg-[#faf8ff] p-5 sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8f96a4]">
                  Số dư hiện tại
                </p>
                <p className="mt-2 font-auth-headline text-2xl font-extrabold tracking-[-0.04em] text-[#2d2f32]">
                  {formatCurrency(currentBalance)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8f96a4]">
                  Người nhận
                </p>
                <p className="mt-2 font-auth-headline text-2xl font-extrabold tracking-[-0.04em] text-[#5868ff]">
                  {previewMeta.recipientLabel}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8f96a4]">
                  Bình quân / người
                </p>
                <p className="mt-2 font-auth-headline text-2xl font-extrabold tracking-[-0.04em] text-[#7b19d8]">
                  {previewMeta.averageLabel}
                </p>
              </div>
            </section>

            {!balanceEnough ? (
              <div className="rounded-[1.2rem] bg-[#fff4f1] px-5 py-4 text-sm font-medium text-[#d4525d]">
                Số dư ví admin chưa đủ để gửi gói quà này.
              </div>
            ) : null}

            {!validRecipientBudget ? (
              <div className="rounded-[1.2rem] bg-[#fff7ea] px-5 py-4 text-sm font-medium text-[#c97a12]">
                Tổng ngân sách phải lớn hơn hoặc bằng số lượng người nhận để tránh
                lỗi chia quà.
              </div>
            ) : null}

            {draft.distributionMode === "equal" ? (
              <div className="rounded-[1.2rem] bg-[#faf1ff] px-5 py-4 text-sm font-medium text-[#7b19d8]">
                Chế độ chia đều đang là giao diện chờ, chưa được API hỗ trợ.
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitDisabled}
                className="auth-premium-gradient auth-soft-shadow inline-flex h-14 items-center justify-center gap-3 rounded-full px-7 text-base font-bold text-white transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <SendHorizontal className="size-4.5" />
                {submitting ? "Đang kích hoạt..." : "Kích hoạt ngay"}
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                className="inline-flex h-14 items-center justify-center rounded-full bg-[#edeaf5] px-7 text-base font-bold text-[#5a4e73] transition-colors hover:bg-[#e6e1f0]"
              >
                Lưu bản nháp
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[1.7rem] bg-white p-6 shadow-[0_24px_55px_-38px_rgba(45,47,50,0.14)]">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-auth-headline text-2xl font-bold text-[#2d2f32]">
                  Xem trước hiển thị
                </h2>
                <p className="mt-1 text-sm text-[#7a8190]">
                  Thẻ chat sẽ dùng lời nhắn, ngân sách và trạng thái mở quà.
                </p>
              </div>
              <span className="rounded-full bg-[#e9f8ef] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#00a46f]">
                Live preview
              </span>
            </div>

            <div className="rounded-[2.2rem] bg-[#f2eff7] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.7)]">
              <div className="rounded-[2rem] bg-white p-4 shadow-[0_24px_55px_-38px_rgba(45,47,50,0.14)]">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#6f7886]">
                  <span>09:41</span>
                  <span>Admin preview</span>
                </div>

                <div className="mt-5 flex items-start gap-2">
                  <div className="size-8 rounded-full bg-[#d7dde7]" />
                  <div className="max-w-[76%] rounded-[1.2rem] rounded-tl-[0.4rem] bg-[#faf8ff] px-4 py-3 text-sm text-[#3f4955]">
                    Chào buổi sáng cả nhà!
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-[1.8rem] bg-[radial-gradient(circle_at_top,#ff7868_0%,#d82828_48%,#a81818_100%)] text-white shadow-[0_24px_55px_-28px_rgba(120,0,0,0.52)]">
                  <div className="relative px-5 pb-5 pt-5">
                    <div className="absolute -left-8 -top-10 size-24 rounded-full bg-white/8 blur-2xl" />
                    <div className="absolute bottom-8 right-5 size-10 rounded-full bg-white/8 blur-xl" />

                    <div className="relative flex items-start gap-3">
                      <div className="flex size-12 items-center justify-center rounded-full bg-[#ffd54f] text-[#8b3000] shadow-[inset_0_2px_8px_rgba(255,255,255,0.36)]">
                        <Gift className="size-6" />
                      </div>
                      <div>
                        <h3 className="font-auth-headline text-lg font-extrabold tracking-[-0.03em]">
                          {titlePreview}
                        </h3>
                        <p className="text-[11px] text-white/80">
                          Từ {user?.displayName ?? "Admin"}
                        </p>
                      </div>
                    </div>

                    <p className="mt-4 border-l-2 border-white/30 pl-3 text-sm italic leading-6 text-[#ffe2c1]">
                      "{notePreview}"
                    </p>

                    <div className="mt-4 flex items-center justify-between rounded-[1.2rem] bg-white/12 px-4 py-3 backdrop-blur-sm">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-white/70">
                          Ngân sách
                        </p>
                        <p className="mt-1 text-sm font-bold">
                          {previewMeta.totalAmountLabel}
                        </p>
                      </div>

                      <button
                        type="button"
                        className="rounded-xl bg-[#ffd54f] px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-[#8b3000]"
                      >
                        Mở ngay
                      </button>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-white/70">
                      <span>{previewMeta.recipientLabel}</span>
                      <span>{trackingLabel}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-[#a51919] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#f7c2c2]">
                    <span>Ví cộng đồng</span>
                    <WalletCards className="size-3.5" />
                  </div>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <div className="max-w-[74%] rounded-[1.2rem] rounded-tr-[0.4rem] bg-[#00a46f] px-4 py-3 text-sm text-white">
                    Woa, sếp vừa phát lì xì cho cả nhóm!
                  </div>
                  <div className="size-8 rounded-full bg-[#d7dde7]" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.7rem] bg-white p-6 shadow-[0_24px_55px_-38px_rgba(45,47,50,0.14)]">
            <h3 className="flex items-center gap-2 font-auth-headline text-xl font-bold text-[#2d2f32]">
              <Sparkles className="size-5 text-[#00a46f]" />
              Lưu ý quan trọng
            </h3>
            <div className="mt-4 space-y-3 text-sm leading-7 text-[#6c7281]">
              <p>Lì xì sẽ bị trừ trực tiếp từ số dư ví admin đang đăng nhập.</p>
              <p>
                Thời gian theo dõi hiện mới là nhãn quản trị nội bộ. API hiện tại
                chưa tự động hết hạn quà theo mốc này.
              </p>
              <p>
                Để tránh lỗi chia tiền ở backend, tổng ngân sách phải lớn hơn hoặc
                bằng số lượng người nhận.
              </p>
              <p>
                {loadingConversation
                  ? "Đang kiểm tra phòng cộng đồng..."
                  : communityConversation
                    ? "Đã sẵn sàng phát quà vào phòng cộng đồng."
                    : "Chưa tìm thấy phòng cộng đồng để phát quà."}
              </p>
            </div>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
