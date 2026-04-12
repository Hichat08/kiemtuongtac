import { AppMobileNav } from "@/components/navigation/app-mobile-nav";
import { createDepositCheckoutDraft, formatDepositCurrency, saveDepositCheckoutDraft } from "@/lib/deposit-checkout";
import type { DepositMethodId } from "@/lib/deposit-checkout";
import { userService } from "@/services/userService";
import { useAuthStore } from "@/stores/useAuthStore";
import type { FinanceSettings } from "@/types/finance";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Landmark,
  Smartphone,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { toast } from "sonner";
import axios from "axios";

interface DepositMethod {
  id: DepositMethodId;
  title: string;
  description: string;
  icon: typeof Landmark;
  iconClassName: string;
  iconWrapClassName: string;
  temporarilyDisabled?: boolean;
}

const QUICK_AMOUNTS = [100000, 500000, 1000000, 2000000, 5000000];

const depositMethods: DepositMethod[] = [
  {
    id: "bank",
    title: "Chuyển khoản ngân hàng",
    description: "Tất cả ngân hàng nội địa",
    icon: Landmark,
    iconClassName: "text-[#7b19d8]",
    iconWrapClassName: "bg-[#f3eef9]",
  },
  {
    id: "momo",
    title: "Ví MoMo",
    description: "Nạp tiền siêu tốc 24/7",
    icon: Wallet,
    iconClassName: "text-[#d8589f]",
    iconWrapClassName: "bg-[#ffeef6]",
    temporarilyDisabled: true,
  },
  {
    id: "zalopay",
    title: "Ví ZaloPay",
    description: "Liên kết trực tiếp Zalo",
    icon: Smartphone,
    iconClassName: "text-[#33a4d8]",
    iconWrapClassName: "bg-[#eaf7ff]",
    temporarilyDisabled: true,
  },
  {
    id: "phone-card",
    title: "Thẻ điện thoại",
    description: "Chiết khấu 15-20% theo nhà mạng",
    icon: Landmark,
    iconClassName: "text-[#7b19d8]",
    iconWrapClassName: "bg-[#f3eef9]",
    temporarilyDisabled: true,
  },
];

const parseAmount = (rawValue: string) => {
  const normalizedValue = rawValue.replace(/\D/g, "");

  if (!normalizedValue) {
    return 0;
  }

  return Number(normalizedValue);
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? fallback;
  }

  return fallback;
};

const defaultFinanceSettings: FinanceSettings = {
  minDepositAmount: 50000,
  minWithdrawalAmount: 50000,
  depositBonusPercent: 0,
  depositBonusEnabled: false,
  withdrawalFeePercent: 0,
  processingMode: "standard",
  processingModeLabel: "Tiêu chuẩn (2 - 6 giờ)",
};

export default function DepositPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [amount, setAmount] = useState(500000);
  const [selectedMethodId, setSelectedMethodId] = useState<DepositMethodId>("bank");
  const [submitting, setSubmitting] = useState(false);
  const [financeSettings, setFinanceSettings] = useState<FinanceSettings>(defaultFinanceSettings);

  useEffect(() => {
    const hydrateFinanceSettings = async () => {
      try {
        const res = await userService.getFinanceSettings();
        setFinanceSettings(res.settings);
      } catch (error) {
        console.error("Không tải được cấu hình tài chính cho màn nạp tiền", error);
      }
    };

    void hydrateFinanceSettings();
  }, []);

  const selectedMethod = useMemo(
    () => depositMethods.find((method) => method.id === selectedMethodId) ?? depositMethods[0],
    [selectedMethodId]
  );
  const isSelectedMethodTemporarilyDisabled = selectedMethod.temporarilyDisabled === true;
  const bonusAmount = 0;
  const totalAmount = amount;

  const amountError = useMemo(() => {
    if (amount <= 0) {
      return "Nhập số tiền bạn muốn nạp.";
    }

    if (amount < financeSettings.minDepositAmount) {
      return `Số tiền nạp tối thiểu là ${formatDepositCurrency(
        financeSettings.minDepositAmount
      )} VND.`;
    }

    return "";
  }, [amount, financeSettings.minDepositAmount]);

  const handleAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    setAmount(parseAmount(event.target.value));
  };

  const handleProceed = async () => {
    if (amountError) {
      toast.error(amountError);
      return;
    }

    if (isSelectedMethodTemporarilyDisabled) {
      toast.error(`${selectedMethod.title} đang tạm khóa. Vui lòng chọn chuyển khoản ngân hàng.`);
      return;
    }

    if (selectedMethodId === "bank") {
      try {
        setSubmitting(true);
        const res = await userService.getDepositReceivingAccount();

        if (!res.account || res.account.status !== "active") {
          toast.error("Admin chưa cấu hình tài khoản nhận tiền để nạp. Vui lòng thử lại sau.");
          return;
        }

        const checkoutDraft = createDepositCheckoutDraft({
          amount,
          bonusAmount,
          totalAmount,
          methodId: selectedMethodId,
          methodTitle: selectedMethod.title,
          userCode: user?.accountId,
          receivingAccount: res.account,
        });

        if (!checkoutDraft) {
          toast.error("Không tạo được thông tin nạp tiền. Vui lòng thử lại sau.");
          return;
        }

        saveDepositCheckoutDraft(checkoutDraft);
        navigate("/wallet/deposit/payment", {
          state: {
            checkout: checkoutDraft,
          },
        });
        return;
      } catch (error) {
        console.error("Không tải được tài khoản nhận tiền của admin", error);
        toast.error(getErrorMessage(error, "Không tải được tài khoản nhận tiền để nạp."));
        return;
      } finally {
        setSubmitting(false);
      }
    }

    toast.info(
      `Cổng ${selectedMethod.title.toLowerCase()} sẽ được nối ở bước tiếp theo.`
    );
  };

  if (user?.role === "admin") {
    return (
      <Navigate
        to="/admin"
        replace
      />
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f8f5ff] font-auth-body text-slate-800 dark:bg-[#12081d] dark:text-slate-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,_rgba(123,25,216,0.16),_transparent_60%)] dark:bg-[radial-gradient(circle_at_top,_rgba(255,102,199,0.16),_transparent_60%)]" />
      <div className="pointer-events-none absolute right-[-5rem] top-20 size-56 rounded-full bg-[#ffd3f2]/70 blur-3xl dark:bg-[#7b19d8]/30" />
      <div className="pointer-events-none absolute left-[-4rem] top-60 size-48 rounded-full bg-[#cbe8ff]/36 blur-3xl dark:bg-[#2b385f]/28" />

      <header className="sticky top-0 z-30 bg-[#f8f5ff]/84 backdrop-blur-xl dark:bg-[#12081d]/82">
        <div className="mobile-page-shell flex items-center gap-3 pb-3 pt-5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex size-10 items-center justify-center rounded-full bg-white/82 text-slate-500 shadow-[0_16px_40px_-26px_rgba(123,25,216,0.45)] transition-colors hover:bg-white active:scale-95 dark:bg-white/10 dark:text-slate-100"
            aria-label="Quay lại"
          >
            <ArrowLeft className="size-5" />
          </button>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9b79cb] dark:text-[#d9b7ff]">
              Ví cá nhân
            </p>
            <h1 className="font-auth-headline text-[1.45rem] font-extrabold tracking-[-0.04em] text-[#2d1459] dark:text-white">
              Nạp tiền
            </h1>
          </div>
        </div>
      </header>

      <main className="mobile-page-shell pb-72 pt-5">
        <section>
          <div className="px-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9a91aa] dark:text-[#d7c7ed]">
              Nhập số tiền
            </p>
          </div>

          <div className="relative mt-4 overflow-hidden rounded-[1.45rem] bg-white/92 px-5 py-5 shadow-[0_18px_45px_-36px_rgba(123,25,216,0.22)] ring-1 ring-black/[0.03] dark:bg-white/8 dark:ring-white/10">
            <div className="absolute right-0 top-0 h-full w-24 bg-[radial-gradient(circle_at_center,_rgba(255,102,199,0.16),_transparent_64%)]" />
            <input
              type="text"
              inputMode="numeric"
              value={amount ? formatDepositCurrency(amount) : ""}
              onChange={handleAmountChange}
              placeholder="0"
              className="relative z-10 w-full bg-transparent pr-16 font-auth-headline text-[clamp(2rem,8vw,3rem)] font-extrabold tracking-[-0.05em] text-slate-900 outline-none placeholder:text-[#c8ccd4] dark:text-white dark:placeholder:text-[#83759b]"
              aria-label="Số tiền nạp"
            />
            <span className="absolute right-5 top-1/2 -translate-y-1/2 font-auth-headline text-sm font-bold text-[#737980] dark:text-[#cdbbe7]">
              VND
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {QUICK_AMOUNTS.map((quickAmount) => {
              const active = amount === quickAmount;

              return (
                <button
                  key={quickAmount}
                  type="button"
                  onClick={() => setAmount(quickAmount)}
                    className={`rounded-[1rem] px-4 py-3.5 text-center font-auth-headline text-sm font-bold transition-all duration-200 active:scale-[0.98] ${
                      active
                      ? "bg-gradient-primary text-white shadow-[0_20px_40px_-24px_rgba(123,25,216,0.46)]"
                      : "bg-[#f2effa] text-[#5f5576] shadow-[0_14px_36px_-34px_rgba(123,25,216,0.16)] dark:bg-white/8 dark:text-[#d7c7ed]"
                  }`}
                 >
                  {formatDepositCurrency(quickAmount)}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setAmount(0)}
              className={`rounded-[1rem] px-4 py-3.5 text-center font-auth-headline text-sm font-bold transition-all duration-200 active:scale-[0.98] ${
                amount > 0
                  ? "bg-[#f2effa] text-[#5f5576] shadow-[0_14px_36px_-34px_rgba(123,25,216,0.16)] dark:bg-white/8 dark:text-[#d7c7ed]"
                  : "bg-gradient-primary text-white shadow-[0_20px_40px_-24px_rgba(123,25,216,0.46)]"
              }`}
            >
              Khác
            </button>
          </div>

          {amountError ? (
            <p className="mt-4 px-1 text-sm font-medium text-[#d4525d] dark:text-[#ff9fb1]">
              {amountError}
            </p>
          ) : (
            <p className="mt-4 px-1 text-sm font-medium text-[#7b8190] dark:text-[#d7c7ed]">
              Mức tối thiểu hiện tại: {formatDepositCurrency(financeSettings.minDepositAmount)} VND
            </p>
          )}
        </section>

        <section className="mt-8">
          <div className="px-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9a91aa] dark:text-[#d7c7ed]">
              Phương thức nạp tiền
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {depositMethods.map((method) => {
              const active = selectedMethodId === method.id;
              const disabled = method.temporarilyDisabled === true;
              const MethodIcon = method.icon;

              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => {
                    if (!disabled) {
                      setSelectedMethodId(method.id);
                    }
                  }}
                  disabled={disabled}
                  className={`flex w-full items-center justify-between gap-3 rounded-[1.35rem] px-4 py-4 text-left transition-all duration-200 ${
                    disabled
                      ? "cursor-not-allowed bg-white/70 opacity-60 shadow-[0_14px_36px_-34px_rgba(123,25,216,0.14)] dark:bg-white/5"
                      : active
                      ? "bg-white shadow-[0_22px_52px_-40px_rgba(123,25,216,0.28)] ring-2 ring-[#d9b7ff] dark:bg-white/10 dark:ring-[#7b19d8]"
                      : "bg-white/88 shadow-[0_18px_48px_-38px_rgba(123,25,216,0.18)] dark:bg-white/6"
                  }`}
                  aria-pressed={active}
                  aria-disabled={disabled}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div
                      className={`flex size-12 shrink-0 items-center justify-center rounded-[1rem] ${method.iconWrapClassName}`}
                    >
                      <MethodIcon className={`size-5 ${method.iconClassName}`} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-auth-headline text-base font-bold text-slate-900 dark:text-white">
                          {method.title}
                        </p>
                        {disabled ? (
                          <span className="rounded-full bg-[#f5efff] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8d66c7] dark:bg-white/10 dark:text-[#dbc6ff]">
                            Tạm khóa
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-xs text-[#8d84a1] dark:text-[#bdaaD6]">
                        {method.description}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                      disabled
                        ? "border-[#ddd6ea] bg-[#f8f5ff] dark:border-white/10 dark:bg-white/5"
                        : active
                        ? "border-[#7b19d8] bg-[#7b19d8] text-white dark:border-[#ff84d1] dark:bg-[#ff84d1] dark:text-[#2d1459]"
                        : "border-[#ddd6ea] bg-white dark:border-white/20 dark:bg-transparent"
                    }`}
                  >
                    {disabled ? null : active ? <CheckCircle2 className="size-4" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-[4.9rem] z-40 bg-[linear-gradient(180deg,rgba(248,245,255,0),rgba(248,245,255,0.92)_18%,rgba(248,245,255,0.98)_100%)] pb-4 pt-6 backdrop-blur-xl dark:bg-[linear-gradient(180deg,rgba(18,8,29,0),rgba(18,8,29,0.92)_18%,rgba(18,8,29,0.98)_100%)]">
        <div className="mobile-page-shell">
          <div className="flex items-end justify-between px-2">
            <div>
              <p className="text-sm font-medium text-[#8d84a1] dark:text-[#bdaaD6]">
                Tổng cộng dự kiến:
              </p>
            </div>
            <div className="text-right">
              <p className="font-auth-headline text-[2rem] font-extrabold tracking-[-0.05em] text-[#2f2441] dark:text-white">
                {formatDepositCurrency(totalAmount)} VND
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleProceed()}
            disabled={Boolean(amountError) || submitting || isSelectedMethodTemporarilyDisabled}
              className={`mt-4 flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 font-auth-headline text-base font-bold text-white transition-transform duration-200 active:scale-[0.99] ${
              amountError || submitting || isSelectedMethodTemporarilyDisabled
                ? "cursor-not-allowed bg-[#bfaed7] shadow-none dark:bg-[#46355d]"
                : "bg-gradient-primary shadow-[0_24px_48px_-28px_rgba(123,25,216,0.52)]"
            }`}
          >
            {submitting
              ? "Đang lấy tài khoản nhận tiền..."
              : isSelectedMethodTemporarilyDisabled
                ? "Phương thức đang tạm khóa"
                : "Tiến hành nạp tiền"}
            <ArrowRight className="size-5" />
          </button>
        </div>
      </div>

      <AppMobileNav />
    </div>
  );
}
