import {
  mapUserBankAccountToWithdrawalBankAccount,
  type WithdrawalBankAccount,
} from "@/lib/withdraw-bank-accounts";
import {
  buildWithdrawalVerificationDraft,
  saveWithdrawalVerificationDraft,
  type WithdrawalVerificationDraft,
} from "@/lib/withdrawal-verification";
import { useUserFinancialData } from "@/hooks/useUserFinancialData";
import { userService } from "@/services/userService";
import { useAuthStore } from "@/stores/useAuthStore";
import type { FinanceSettings, WithdrawalType } from "@/types/finance";
import type { InternalTransferRecipient } from "@/types/user";
import axios from "axios";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock3,
  Info,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

const formatNumber = (value: number) =>
  new Intl.NumberFormat("vi-VN").format(value);

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

const roundQuickAmount = (value: number) => {
  if (value >= 1_000_000) {
    return Math.ceil(value / 100_000) * 100_000;
  }

  if (value >= 100_000) {
    return Math.ceil(value / 50_000) * 50_000;
  }

  return Math.ceil(value / 10_000) * 10_000;
};

const buildQuickAmounts = (minWithdrawalAmount: number) => {
  const baseAmount = Math.max(minWithdrawalAmount, 50_000);

  return Array.from(
    new Set([1, 2, 5, 10].map((multiplier) => roundQuickAmount(baseAmount * multiplier)))
  ).slice(0, 4);
};

const quickAmountSurfaceStyles = [
  "bg-[#f3eef9] text-[#6f6591]",
  "bg-[#fdf0f8] text-[#9b5a83]",
  "bg-[#eef1ff] text-[#5868ff]",
  "bg-[#eefbf4] text-[#00a46f]",
] as const;

const defaultFinanceSettings: FinanceSettings = {
  minDepositAmount: 50000,
  minWithdrawalAmount: 50000,
  depositBonusPercent: 0,
  depositBonusEnabled: false,
  withdrawalFeePercent: 0,
  processingMode: "standard",
  processingModeLabel: "Tiêu chuẩn (2 - 6 giờ)",
};

type WithdrawPageLocationState = {
  newBankAccountId?: string;
  verificationDraft?: WithdrawalVerificationDraft;
} | null;

const INTERNAL_TRANSFER_BANK_NAME = "Chuyển tiền nội bộ";
const INTERNAL_TRANSFER_BANK_CODE = "INTERNAL";

export default function WithdrawPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { currentBalance, withdrawableBalance } = useUserFinancialData(user?.accountId);
  const locationState = location.state as WithdrawPageLocationState;
  const hasDraftAmount = Number.isFinite(locationState?.verificationDraft?.amount);
  const [amount, setAmount] = useState(() =>
    hasDraftAmount
      ? Number(locationState?.verificationDraft?.amount)
      : 0
  );
  const [withdrawalType, setWithdrawalType] = useState<WithdrawalType>(
    locationState?.verificationDraft?.withdrawalType === "internal" ? "internal" : "bank"
  );
  const [selectedBankId, setSelectedBankId] = useState("");
  const [bankAccounts, setBankAccounts] = useState<WithdrawalBankAccount[]>([]);
  const [loadingBankAccounts, setLoadingBankAccounts] = useState(true);
  const [requestingVerificationStep, setRequestingVerificationStep] = useState(false);
  const [financeSettings, setFinanceSettings] = useState<FinanceSettings>(defaultFinanceSettings);
  const [financeSettingsLoaded, setFinanceSettingsLoaded] = useState(false);
  const [recipientAccountId, setRecipientAccountId] = useState(
    locationState?.verificationDraft?.recipientAccountId ?? ""
  );
  const [internalRecipient, setInternalRecipient] = useState<InternalTransferRecipient | null>(() =>
    locationState?.verificationDraft?.recipientAccountId &&
    locationState?.verificationDraft?.recipientDisplayName
      ? {
          _id: locationState?.verificationDraft?.recipientUserId ?? "",
          accountId: locationState?.verificationDraft?.recipientAccountId ?? "",
          displayName: locationState?.verificationDraft?.recipientDisplayName ?? "",
          username: locationState?.verificationDraft?.recipientAccountId ?? "",
          avatarUrl: undefined,
        }
      : null
  );
  const [lookingUpRecipient, setLookingUpRecipient] = useState(false);
  const [internalRecipientLookupError, setInternalRecipientLookupError] = useState("");
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [hasTouchedAmount, setHasTouchedAmount] = useState(hasDraftAmount);
  const [hasTouchedRecipient, setHasTouchedRecipient] = useState(
    Boolean(locationState?.verificationDraft?.recipientAccountId)
  );
  const autoAmountInitializedRef = useRef(hasDraftAmount);

  useEffect(() => {
    const hydrateBankAccounts = async () => {
      try {
        setLoadingBankAccounts(true);
        const res = await userService.getBankAccounts();
        setBankAccounts(res.accounts.map(mapUserBankAccountToWithdrawalBankAccount));
      } catch (error) {
        console.error("Không tải được danh sách tài khoản ngân hàng user", error);
        toast.error(getErrorMessage(error, "Không tải được danh sách tài khoản ngân hàng."));
        setBankAccounts([]);
      } finally {
        setLoadingBankAccounts(false);
      }
    };

    void hydrateBankAccounts();
  }, []);

  useEffect(() => {
    const hydrateFinanceSettings = async () => {
      try {
        const res = await userService.getFinanceSettings();
        setFinanceSettings(res.settings);
      } catch (error) {
        console.error("Không tải được cấu hình tài chính cho màn rút tiền", error);
      } finally {
        setFinanceSettingsLoaded(true);
      }
    };

    void hydrateFinanceSettings();
  }, []);

  useEffect(() => {
    if (Number.isFinite(locationState?.verificationDraft?.amount)) {
      setAmount(Number(locationState?.verificationDraft?.amount));
    }
  }, [locationState?.verificationDraft?.amount]);

  useEffect(() => {
    if (hasDraftAmount || autoAmountInitializedRef.current || !financeSettingsLoaded) {
      return;
    }

    autoAmountInitializedRef.current = true;

    if (withdrawableBalance >= financeSettings.minWithdrawalAmount) {
      setAmount(financeSettings.minWithdrawalAmount);
    }
  }, [
    financeSettings.minWithdrawalAmount,
    financeSettingsLoaded,
    hasDraftAmount,
    withdrawableBalance,
  ]);

  useEffect(() => {
    const draft = locationState?.verificationDraft;

    if (!draft) {
      return;
    }

    setWithdrawalType(draft.withdrawalType === "internal" ? "internal" : "bank");
    setRecipientAccountId(draft.recipientAccountId ?? "");

    if (draft.recipientAccountId && draft.recipientDisplayName) {
      setInternalRecipient({
        _id: draft.recipientUserId ?? "",
        accountId: draft.recipientAccountId,
        displayName: draft.recipientDisplayName,
        username: draft.recipientAccountId,
        avatarUrl: undefined,
      });
      setInternalRecipientLookupError("");
    }
  }, [
    locationState?.verificationDraft,
    locationState?.verificationDraft?.recipientAccountId,
    locationState?.verificationDraft?.recipientDisplayName,
    locationState?.verificationDraft?.recipientUserId,
    locationState?.verificationDraft?.withdrawalType,
  ]);

  useEffect(() => {
    if (!bankAccounts.length) {
      setSelectedBankId("");
      return;
    }

    const verificationDraftBankAccountId = locationState?.verificationDraft?.bankAccountId;
    const preferredId =
      (locationState?.newBankAccountId &&
      bankAccounts.some((bank) => bank.id === locationState.newBankAccountId)
        ? locationState.newBankAccountId
        : null) ??
      (verificationDraftBankAccountId &&
      bankAccounts.some((bank) => bank.id === verificationDraftBankAccountId)
        ? verificationDraftBankAccountId
        : null) ??
      bankAccounts.find((bank) => bank.primary)?.id ??
      bankAccounts.find((bank) => bank.active)?.id ??
      bankAccounts[0]?.id ??
      "";

    setSelectedBankId((current) =>
      bankAccounts.some((bank) => bank.id === current) ? current : preferredId
    );
  }, [bankAccounts, locationState?.newBankAccountId, locationState?.verificationDraft?.bankAccountId]);

  const selectedBank = useMemo(
    () => bankAccounts.find((bank) => bank.id === selectedBankId) ?? bankAccounts[0] ?? null,
    [bankAccounts, selectedBankId]
  );
  const isInternalWithdrawal = withdrawalType === "internal";
  const quickAmounts = useMemo(
    () => buildQuickAmounts(financeSettings.minWithdrawalAmount),
    [financeSettings.minWithdrawalAmount]
  );
  const feeAmount = isInternalWithdrawal
    ? 0
    : Math.round((Math.max(amount, 0) * financeSettings.withdrawalFeePercent) / 100);
  const receivableAmount = Math.max(amount - feeAmount, 0);
  const bankError = useMemo(() => {
    if (loadingBankAccounts) {
      return "";
    }

    if (!selectedBank) {
      return "Bạn chưa có tài khoản ngân hàng nhận tiền. Vui lòng thêm mới.";
    }

    if (selectedBank.status === "locked") {
      return "Tài khoản nhận tiền này đang bị khóa. Hãy cập nhật hoặc dùng tài khoản khác.";
    }

    if (!selectedBank.active) {
      return "Tài khoản nhận tiền này đang chờ admin xác minh.";
    }

    return "";
  }, [loadingBankAccounts, selectedBank]);
  const estimatedArrivalLabel = isInternalWithdrawal
    ? "Tức thì"
    : !selectedBank
      ? "Chưa sẵn sàng"
      : selectedBank.status === "locked"
        ? "Đang bị khóa"
        : selectedBank.active
          ? financeSettings.processingModeLabel
          : "Chờ xác minh";

  const amountError = useMemo(() => {
    if (amount <= 0) {
      return isInternalWithdrawal ? "Nhập số tiền bạn muốn chuyển." : "Nhập số tiền bạn muốn rút.";
    }

    if (amount < financeSettings.minWithdrawalAmount) {
      return `${isInternalWithdrawal ? "Số tiền chuyển" : "Số tiền rút"} tối thiểu là ${formatNumber(
        financeSettings.minWithdrawalAmount
      )} VND.`;
    }

    if (amount > withdrawableBalance) {
      return "Số dư hiện tại không đủ để thực hiện giao dịch này.";
    }

    return "";
  }, [amount, financeSettings.minWithdrawalAmount, isInternalWithdrawal, withdrawableBalance]);

  const internalRecipientError = useMemo(() => {
    if (!isInternalWithdrawal) {
      return "";
    }

    if (!recipientAccountId) {
      return "Nhập số tài khoản nội bộ của người nhận.";
    }

    if (recipientAccountId.length < 8) {
      return "Số tài khoản nội bộ phải gồm đủ 8 chữ số.";
    }

    if (lookingUpRecipient) {
      return "";
    }

    if (internalRecipientLookupError) {
      return internalRecipientLookupError;
    }

    if (!internalRecipient || internalRecipient.accountId !== recipientAccountId) {
      return "Hãy nhập đúng số tài khoản nội bộ để hệ thống tự xác nhận người nhận.";
    }

    return "";
  }, [
    internalRecipient,
    internalRecipientLookupError,
    isInternalWithdrawal,
    lookingUpRecipient,
    recipientAccountId,
  ]);

  const activeValidationError = amountError || (isInternalWithdrawal ? internalRecipientError : bankError);
  const visibleAmountError = hasAttemptedSubmit || hasTouchedAmount ? amountError : "";
  const visibleTargetError = isInternalWithdrawal
    ? hasAttemptedSubmit || hasTouchedRecipient
      ? internalRecipientError
      : ""
    : hasAttemptedSubmit
      ? bankError
      : "";
  const visibleValidationError = visibleAmountError || visibleTargetError;
  const missingVerificationTarget =
    (!isInternalWithdrawal && !selectedBank) || (isInternalWithdrawal && !internalRecipient);
  const isVerificationBlocked = Boolean(
    activeValidationError ||
      missingVerificationTarget ||
      requestingVerificationStep ||
      !user?.emailVerified ||
      !user?.email
  );
  const readinessLabel = !user?.emailVerified || !user?.email
    ? "Thiếu email xác minh"
    : activeValidationError || missingVerificationTarget
      ? "Cần hoàn tất thông tin"
      : "Sẵn sàng xác nhận";
  const readinessClassName = !user?.emailVerified || !user?.email
    ? "text-[#d4525d] dark:text-[#ff9fb1]"
    : activeValidationError || missingVerificationTarget
      ? "text-[#8d84a1] dark:text-[#d5c5ec]"
      : "text-[#00a46f] dark:text-[#84f0be]";
  const transactionTitle = isInternalWithdrawal ? "Chuyển tiền nội bộ" : "Rút tiền";
  const transactionTypeHeading = "Hình thức giao dịch";
  const transactionTypeDescription = "Chọn rút về ngân hàng hoặc chuyển tiền nội bộ bằng ID người dùng.";
  const transactionAmountHeading = isInternalWithdrawal ? "Nhập số tiền chuyển" : "Nhập số tiền rút";
  const transactionAmountAriaLabel = isInternalWithdrawal ? "Số tiền chuyển" : "Số tiền rút";
  const maxAmountLabel = isInternalWithdrawal ? "Chuyển tối đa" : "Rút tối đa";
  const feeCardLabel = isInternalWithdrawal ? "Phí chuyển" : "Phí rút tiền";
  const verificationButtonLabel = isInternalWithdrawal ? "Xác nhận chuyển tiền nội bộ" : "Xác nhận rút tiền";

  const handleAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    setHasTouchedAmount(true);
    setAmount(parseAmount(event.target.value));
  };

  const handleRecipientAccountIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value.replace(/\D/g, "").slice(0, 8);
    setHasTouchedRecipient(true);
    setRecipientAccountId(nextValue);
    setInternalRecipient((current) =>
      current?.accountId === nextValue ? current : null
    );
    setInternalRecipientLookupError("");
  };

  const handleWithdrawalTypeChange = (nextType: WithdrawalType) => {
    setWithdrawalType(nextType);
    setInternalRecipientLookupError("");
  };

  useEffect(() => {
    if (!isInternalWithdrawal) {
      setLookingUpRecipient(false);
      return;
    }

    if (!recipientAccountId) {
      setInternalRecipient(null);
      setLookingUpRecipient(false);
      setInternalRecipientLookupError("");
      return undefined;
    }

    if (recipientAccountId.length < 8) {
      setInternalRecipient(null);
      setLookingUpRecipient(false);
      setInternalRecipientLookupError("");
      return undefined;
    }

    if (internalRecipient?.accountId === recipientAccountId) {
      return undefined;
    }

    let cancelled = false;
    const lookupTimer = window.setTimeout(async () => {
      try {
        setLookingUpRecipient(true);
        const response = await userService.getInternalTransferRecipient(recipientAccountId);

        if (cancelled) {
          return;
        }

        setInternalRecipient(response.user);
        setInternalRecipientLookupError("");
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Không tra cứu được người nhận nội bộ", error);
        setInternalRecipient(null);
        setInternalRecipientLookupError(
          getErrorMessage(error, "Không thể tra cứu người nhận nội bộ.")
        );
      } finally {
        if (!cancelled) {
          setLookingUpRecipient(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(lookupTimer);
    };
  }, [internalRecipient?.accountId, isInternalWithdrawal, recipientAccountId]);

  const handleStartWithdrawalVerification = async () => {
    setHasAttemptedSubmit(true);

    if (
      activeValidationError ||
      (!isInternalWithdrawal && !selectedBank) ||
      (isInternalWithdrawal && !internalRecipient)
    ) {
      toast.error(
        activeValidationError ||
          (isInternalWithdrawal
            ? "Chưa xác định được người nhận nội bộ."
            : "Chưa chọn tài khoản ngân hàng.")
      );
      return;
    }

    if (!user?.emailVerified || !user?.email) {
      toast.error("Tài khoản cần có email đã xác minh để thực hiện giao dịch này.");
      return;
    }

    try {
      setRequestingVerificationStep(true);
      const res = await userService.requestWithdrawalVerificationCode();
      const verificationDraft = buildWithdrawalVerificationDraft({
        amount,
        target: isInternalWithdrawal
          ? {
              withdrawalType: "internal",
              bankName: INTERNAL_TRANSFER_BANK_NAME,
              bankCode: INTERNAL_TRANSFER_BANK_CODE,
              accountNumber: internalRecipient?.accountId ?? recipientAccountId,
              accountHolder: internalRecipient?.displayName ?? "",
              recipientUserId: internalRecipient?._id,
              recipientAccountId: internalRecipient?.accountId ?? recipientAccountId,
              recipientDisplayName: internalRecipient?.displayName ?? "",
            }
          : {
              withdrawalType: "bank",
              bankAccountId: selectedBank?.id,
              bankName: selectedBank?.name ?? "",
              bankCode: selectedBank?.bankCode,
              accountNumber: selectedBank?.accountNumber ?? "",
              accountHolder: selectedBank?.accountHolder,
            },
        resendAfter: res.resendAfter,
        expiresIn: res.expiresIn,
      });

      saveWithdrawalVerificationDraft(verificationDraft);

      if (res.sent) {
        toast.success(
          isInternalWithdrawal
            ? "Mã xác minh chuyển tiền nội bộ đã được gửi tới email của bạn."
            : "Mã xác minh rút tiền đã được gửi tới email của bạn."
        );
      } else {
        toast.info("Mã xác minh hiện vẫn còn hiệu lực.");
      }

      navigate("/wallet/withdraw/verify", {
        state: { draft: verificationDraft },
      });
    } catch (error) {
      console.error("Không gửi được mã xác minh rút tiền", error);
      toast.error(
        getErrorMessage(
          error,
          isInternalWithdrawal
            ? "Không thể gửi mã xác minh chuyển tiền nội bộ."
            : "Không thể gửi mã xác minh rút tiền."
        )
      );
    } finally {
      setRequestingVerificationStep(false);
    }
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
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,_rgba(123,25,216,0.16),_transparent_58%)] dark:bg-[radial-gradient(circle_at_top,_rgba(255,102,199,0.18),_transparent_60%)]" />
      <div className="pointer-events-none absolute right-[-5rem] top-24 size-56 rounded-full bg-[#ffd3f2]/68 blur-3xl dark:bg-[#7b19d8]/30" />
      <div className="pointer-events-none absolute left-[-4rem] top-52 size-48 rounded-full bg-[#cbe8ff]/38 blur-3xl dark:bg-[#3b2d68]/40" />
      <div className="pointer-events-none absolute bottom-10 right-[-5rem] size-64 rounded-full bg-[#b8f3da]/16 blur-3xl dark:bg-[#00c88b]/10" />

      <header className="sticky top-0 z-30 bg-[#f8f5ff]/82 backdrop-blur-xl dark:bg-[#12081d]/82">
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
              {transactionTitle}
            </h1>
          </div>
        </div>
      </header>

      <main className="mobile-page-shell pb-44 pt-4">
        <section className="mt-3">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-primary p-6 text-white shadow-[0_30px_80px_-35px_rgba(123,25,216,0.62)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.18),_transparent_26%),radial-gradient(circle_at_bottom_left,_rgba(255,255,255,0.1),_transparent_30%)]" />
            <div className="absolute -right-8 top-10 size-28 rounded-full bg-white/12 blur-2xl" />

            <div className="relative z-10">
              <div className="flex items-start justify-between gap-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/86">
                  <CheckCircle2 className="size-3.5" />
                  Tài khoản an toàn
                </div>
                <div className="rounded-full bg-white/14 px-3 py-1 text-[11px] font-semibold text-white/86">
                  {isInternalWithdrawal
                    ? "Nhận đủ 100%"
                    : financeSettings.withdrawalFeePercent > 0
                    ? `Phí ${financeSettings.withdrawalFeePercent}%`
                    : "Miễn phí giao dịch"}
                </div>
              </div>

              <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/72">
                Số dư hiện tại
              </p>
              <div className="mt-3 flex items-end gap-2">
                <p className="font-auth-headline text-[2.55rem] font-extrabold tracking-[-0.06em]">
                  {formatNumber(currentBalance)}
                </p>
                <span className="pb-1 font-auth-headline text-lg font-bold text-white/80">
                  VND
                </span>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3 rounded-[1.15rem] bg-white/10 px-4 py-3 backdrop-blur-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/56">
                    {isInternalWithdrawal ? "Người nhận nội bộ" : "Ngân hàng mặc định"}
                  </p>
                  <p className="mt-1 font-auth-headline text-sm font-bold">
                    {isInternalWithdrawal
                      ? internalRecipient?.displayName || "Chưa chọn người nhận"
                      : selectedBank?.name ?? "Chưa có tài khoản"}
                  </p>
                </div>
                <div className="rounded-full bg-white/12 px-3 py-1 text-[11px] font-semibold text-white/86">
                  {estimatedArrivalLabel}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-7 rounded-[1.7rem] bg-white/88 p-4 shadow-[0_24px_60px_-40px_rgba(123,25,216,0.24)] backdrop-blur-2xl dark:bg-white/8">
          <div className="px-1">
              <h2 className="font-auth-headline text-lg font-bold text-slate-900 dark:text-white">
                {transactionTypeHeading}
              </h2>
              <p className="mt-1 text-xs text-[#8d84a1] dark:text-[#bdaaD6]">
                {transactionTypeDescription}
              </p>
            </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleWithdrawalTypeChange("bank")}
              className={`rounded-[1.2rem] px-4 py-4 text-left transition-all ${
                !isInternalWithdrawal
                  ? "bg-gradient-primary text-white shadow-[0_18px_36px_-24px_rgba(123,25,216,0.45)]"
                  : "bg-[#f7f4ff] text-[#5f6772] shadow-[0_16px_42px_-40px_rgba(123,25,216,0.16)]"
              }`}
            >
              <p className="font-auth-headline text-base font-bold">Ngân hàng</p>
              <p className={`mt-1 text-xs leading-5 ${!isInternalWithdrawal ? "text-white/80" : "text-[#8e959e]"}`}>
                Tạo yêu cầu rút và chờ admin xử lý như hiện tại.
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleWithdrawalTypeChange("internal")}
              className={`rounded-[1.2rem] px-4 py-4 text-left transition-all ${
                isInternalWithdrawal
                  ? "bg-gradient-primary text-white shadow-[0_18px_36px_-24px_rgba(123,25,216,0.45)]"
                  : "bg-[#f7f4ff] text-[#5f6772] shadow-[0_16px_42px_-40px_rgba(123,25,216,0.16)]"
              }`}
            >
              <p className="font-auth-headline text-base font-bold">Chuyển tiền nội bộ</p>
              <p className={`mt-1 text-xs leading-5 ${isInternalWithdrawal ? "text-white/80" : "text-[#8e959e]"}`}>
                Người nhận dùng đúng ID tài khoản, hệ thống xử lý tức thì.
              </p>
            </button>
          </div>
        </section>

        <section className="mt-7 rounded-[1.7rem] bg-white/88 p-4 shadow-[0_24px_60px_-40px_rgba(123,25,216,0.34)] backdrop-blur-2xl dark:bg-white/8">
          <div className="px-1">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-auth-headline text-lg font-bold text-slate-900 dark:text-white">
                {transactionAmountHeading}
              </h2>
              <span className="shrink-0 rounded-full bg-[#f3eef9] px-3 py-1 text-[11px] font-semibold text-[#6f6591] dark:bg-white/10 dark:text-[#d7c7ed]">
                Tối thiểu {formatNumber(financeSettings.minWithdrawalAmount)}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#8d84a1] dark:text-[#bdaaD6]">
              Chọn nhanh hoặc nhập thủ công theo nhu cầu của bạn.
            </p>
          </div>

          <div className="relative mt-5 overflow-hidden rounded-[1.45rem] bg-[#faf8ff] px-5 py-5 shadow-[0_18px_45px_-36px_rgba(123,25,216,0.2)] ring-1 ring-black/[0.03] dark:bg-white/6 dark:ring-white/10">
            <div className="absolute right-0 top-0 h-full w-24 bg-[radial-gradient(circle_at_center,_rgba(255,102,199,0.16),_transparent_64%)]" />
            <input
              type="text"
              inputMode="numeric"
              value={amount ? formatNumber(amount) : ""}
              onChange={handleAmountChange}
              onBlur={() => setHasTouchedAmount(true)}
              placeholder="0"
              className="relative z-10 w-full bg-transparent pr-16 font-auth-headline text-[2.15rem] font-extrabold tracking-[-0.05em] text-slate-900 outline-none placeholder:text-[#c8ccd4] dark:text-white dark:placeholder:text-[#83759b]"
              aria-label={transactionAmountAriaLabel}
            />
            <span className="absolute right-5 top-1/2 -translate-y-1/2 font-auth-headline text-sm font-bold text-[#737980] dark:text-[#cdbbe7]">
              VND
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-[1.15rem] bg-[#f2effa] px-4 py-3 dark:bg-white/8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a91aa]">
                Khả dụng
              </p>
              <p className="mt-1 font-auth-headline text-lg font-bold text-slate-900 dark:text-white">
                {formatNumber(withdrawableBalance)} VND
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setHasTouchedAmount(true);
                setAmount(withdrawableBalance);
              }}
              disabled={withdrawableBalance <= 0}
              className="rounded-[1.15rem] bg-[#fff1f4] px-4 py-3 text-left shadow-[0_18px_40px_-36px_rgba(212,82,93,0.24)] transition-transform duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 dark:bg-[#3a1420]"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c57584] dark:text-[#f0b5c1]">
                {maxAmountLabel}
              </p>
              <p className="mt-1 font-auth-headline text-lg font-bold text-[#d4525d] dark:text-[#ff9fb1]">
                {formatNumber(withdrawableBalance)} VND
              </p>
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {quickAmounts.map((quickAmount, index) => {
              const active = amount === quickAmount;
              const exceedsBalance = quickAmount > withdrawableBalance;

              return (
                <button
                  key={quickAmount}
                  type="button"
                  onClick={() => {
                    setHasTouchedAmount(true);
                    setAmount(quickAmount);
                  }}
                  disabled={exceedsBalance}
                  className={`rounded-[1rem] px-4 py-4 text-center font-auth-headline text-base font-bold transition-all duration-200 active:scale-[0.98] ${
                    active
                      ? "bg-gradient-primary text-white shadow-[0_18px_36px_-20px_rgba(123,25,216,0.5)]"
                      : `${quickAmountSurfaceStyles[index]} shadow-[0_14px_38px_-34px_rgba(35,52,61,0.18)]`
                  } disabled:cursor-not-allowed disabled:opacity-45`}
                >
                  {formatNumber(quickAmount)}đ
                </button>
              );
            })}
          </div>

          {visibleAmountError ? (
            <p className="mt-4 px-1 text-sm font-medium text-[#c0424f]">{visibleAmountError}</p>
          ) : visibleValidationError ? (
            <p className="mt-4 px-1 text-sm font-medium text-[#c0424f]">
              {visibleValidationError}
            </p>
          ) : (
            <div className="mt-4 flex items-center justify-between rounded-[1rem] bg-[#eefbf4] px-4 py-3 text-sm dark:bg-[#123323]">
              <div className="flex items-center gap-2 text-[#4b8a72] dark:text-[#9fe4bf]">
                <Info className="size-4" />
                <span>
                  {isInternalWithdrawal ? "Người nhận sẽ nhận đủ" : "Thực nhận dự kiến sau phí"}
                </span>
              </div>
              <span className="font-auth-headline text-base font-bold text-[#00a46f] dark:text-[#84f0be]">
                {formatNumber(receivableAmount)} VND
              </span>
            </div>
          )}
        </section>

        <section className="mt-7 rounded-[1.7rem] bg-white/88 p-4 shadow-[0_24px_60px_-40px_rgba(123,25,216,0.3)] backdrop-blur-2xl dark:bg-white/8">
          {isInternalWithdrawal ? (
            <>
              <div className="px-1">
                <h2 className="font-auth-headline text-lg font-bold text-slate-900 dark:text-white">
                  Số tài khoản nội bộ
                </h2>
                <p className="mt-1 text-xs text-[#8d84a1] dark:text-[#bdaaD6]">
                  Dùng ID người dùng 8 số của người nhận làm số tài khoản nội bộ.
                </p>
              </div>

              <div className="mt-5">
                <input
                  type="text"
                  inputMode="numeric"
                  value={recipientAccountId}
                  onChange={handleRecipientAccountIdChange}
                  onBlur={() => setHasTouchedRecipient(true)}
                  placeholder="Nhập số tài khoản nội bộ"
                  className="h-12 w-full rounded-[1rem] border-none bg-[#f7f4ff] px-4 font-auth-headline text-base font-bold text-slate-900 outline-none placeholder:text-[#b8b0c6] dark:bg-white/6 dark:text-white dark:placeholder:text-[#8a7ca3]"
                  aria-label="Số tài khoản nội bộ người nhận"
                />
              </div>

              {lookingUpRecipient ? (
                <div className="mt-4 rounded-[1.25rem] bg-[#f7f4ff] px-4 py-5 text-sm leading-6 text-[#7b7190] dark:bg-white/6 dark:text-[#d5c5ec]">
                  Hệ thống đang tự động xác nhận người nhận theo số tài khoản nội bộ bạn vừa nhập.
                </div>
              ) : internalRecipient ? (
                <div className="mt-4 flex items-center gap-4 rounded-[1.25rem] bg-[#f7f4ff] px-4 py-4 shadow-[0_16px_42px_-40px_rgba(123,25,216,0.16)] dark:bg-white/6">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-[0.95rem] bg-[#f3edff] font-auth-headline text-sm font-extrabold text-[#7b19d8]">
                    {internalRecipient.displayName
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase() ?? "")
                      .join("") || "ID"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-auth-headline text-base font-bold text-slate-900 dark:text-white">
                        {internalRecipient.displayName}
                      </p>
                      <span className="rounded-full bg-[#eefbf4] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#00a46f]">
                        Hợp lệ
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-[#8e959e] dark:text-[#bdaaD6]">
                      ID {internalRecipient.accountId} • @{internalRecipient.username}
                    </p>
                  </div>
                  <BadgeCheck className="size-5 shrink-0 text-[#7b19d8] dark:text-[#ff84d1]" />
                </div>
              ) : (
                <div className="mt-4 rounded-[1.25rem] bg-[#f7f4ff] px-4 py-5 text-sm leading-6 text-[#7b7190] dark:bg-white/6 dark:text-[#d5c5ec]">
                  Nhập đủ 8 số tài khoản nội bộ, hệ thống sẽ tự động hiển thị người nhận hợp lệ.
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between px-1">
                <div>
                  <h2 className="font-auth-headline text-lg font-bold text-slate-900 dark:text-white">
                    Tài khoản ngân hàng
                  </h2>
                  <p className="mt-1 text-xs text-[#8d84a1] dark:text-[#bdaaD6]">
                    Chọn nơi nhận tiền cho yêu cầu rút này.
                    Chọn nơi nhận tiền cho yêu cầu rút này.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/wallet/withdraw/add-bank")}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#f3eef9] px-3 py-1.5 text-sm font-semibold text-[#7b19d8] transition-opacity hover:opacity-85 dark:bg-white/10 dark:text-[#ff84d1]"
                >
                  <Plus className="size-4" />
                  Thêm mới
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {loadingBankAccounts ? (
                  <div className="rounded-[1.25rem] bg-[#f7f4ff] px-4 py-5 text-sm font-medium text-[#7b7190] dark:bg-white/6 dark:text-[#d5c5ec]">
                    Đang tải tài khoản ngân hàng...
                  </div>
                ) : bankAccounts.length ? (
                  bankAccounts.map((bank) => {
                    const active = bank.id === selectedBankId;
                    const statusLabel =
                      bank.status === "verified"
                        ? "Đã xác minh"
                        : bank.status === "locked"
                          ? "Đã khóa"
                          : "Chờ duyệt";

                    return (
                      <button
                        key={bank.id}
                        type="button"
                        onClick={() => setSelectedBankId(bank.id)}
                        className={`flex w-full items-center gap-4 rounded-[1.25rem] px-4 py-4 text-left transition-all duration-200 active:scale-[0.99] ${
                          active
                            ? "bg-white shadow-[0_22px_52px_-40px_rgba(123,25,216,0.28)] ring-2 ring-[#d9b7ff] dark:bg-white/10 dark:ring-[#7b19d8]"
                            : "bg-[#f7f4ff] shadow-[0_16px_42px_-40px_rgba(123,25,216,0.16)] dark:bg-white/6"
                        }`}
                        aria-pressed={active}
                      >
                        <div
                          className={`flex size-12 shrink-0 items-center justify-center rounded-[0.95rem] font-auth-headline text-sm font-extrabold ${bank.logoClassName}`}
                        >
                          {bank.logoLabel}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className={`font-auth-headline text-base font-bold ${
                                active
                                  ? "text-slate-900 dark:text-white"
                                  : "text-[#5f6772] dark:text-[#d5c5ec]"
                              }`}
                            >
                              {bank.name}
                            </p>
                            {bank.primary ? (
                              <span className="rounded-full bg-[#f3eef9] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7b19d8] dark:bg-white/12 dark:text-[#ff84d1]">
                                Ưu tiên
                              </span>
                            ) : null}
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                                bank.status === "verified"
                                  ? "bg-[#eefbf4] text-[#00a46f]"
                                  : bank.status === "locked"
                                    ? "bg-[#fff1f4] text-[#d4525d]"
                                    : "bg-[#eef1ff] text-[#5868ff]"
                              }`}
                            >
                              {statusLabel}
                            </span>
                          </div>
                          <p className="mt-1 text-xs font-medium text-[#8e959e] dark:text-[#bdaaD6]">
                            {bank.accountNumber}
                          </p>
                        </div>

                        {active ? (
                          <BadgeCheck className="size-5 shrink-0 text-[#7b19d8] dark:text-[#ff84d1]" />
                        ) : (
                          <Check className="size-5 shrink-0 text-[#d2d7dd]" />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-[1.25rem] bg-[#f7f4ff] px-4 py-5 text-sm leading-6 text-[#7b7190] dark:bg-white/6 dark:text-[#d5c5ec]">
                    Chưa có tài khoản ngân hàng nhận tiền. Hãy thêm tài khoản và gửi xác minh để rút tiền.
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        <section className="mt-7 grid grid-cols-2 gap-3">
          <div className="rounded-[1.35rem] bg-[#f2effa] p-4 shadow-[0_18px_45px_-38px_rgba(123,25,216,0.18)] dark:bg-white/8">
            <div className="flex size-10 items-center justify-center rounded-full bg-[#eef1ff] text-[#5868ff]">
              <Info className="size-4.5" />
            </div>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a91aa]">
                {feeCardLabel}
              </p>
            <p className="mt-2 font-auth-headline text-xl font-bold text-slate-900 dark:text-white">
              {isInternalWithdrawal
                ? "0%"
                : financeSettings.withdrawalFeePercent > 0
                ? `${financeSettings.withdrawalFeePercent}%`
                : "Miễn phí"}
            </p>
          </div>

          <div className="rounded-[1.35rem] bg-[#f2effa] p-4 shadow-[0_18px_45px_-38px_rgba(123,25,216,0.18)] dark:bg-white/8">
            <div className="flex size-10 items-center justify-center rounded-full bg-[#fff0f2] text-[#d4525d] dark:bg-[#3a1420] dark:text-[#ff9fb1]">
              <Clock3 className="size-4.5" />
            </div>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a91aa]">
              Thời gian xử lý
            </p>
            <p className="mt-2 font-auth-headline text-xl font-bold text-slate-900 dark:text-white">
              {estimatedArrivalLabel}
            </p>
          </div>
        </section>

        <section className="relative mt-7 overflow-hidden rounded-[1.5rem] bg-[#151a22] p-4 text-white shadow-[0_30px_80px_-35px_rgba(22,18,41,0.65)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(123,25,216,0.26),_transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.02),rgba(255,255,255,0))]" />
          <div className="flex items-start gap-3">
            <div className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-[1rem] bg-white/10 text-[#ff84d1]">
              <ShieldCheck className="size-5" />
            </div>

            <div className="relative z-10 min-w-0 flex-1">
              <p className="font-auth-headline text-base font-bold">
                {isInternalWithdrawal
                  ? "Lệnh chuyển sẽ gắn đúng ID người nhận"
                  : "Lệnh rút sẽ gắn đúng hồ sơ nhận tiền"}
              </p>
              <p className="mt-1 text-sm leading-6 text-white/72">
                {isInternalWithdrawal
                  ? internalRecipient
                    ? `${user?.displayName ?? "Tài khoản cá nhân"} → ${internalRecipient.displayName} • ID ${internalRecipient.accountId}`
                    : "Chưa có người nhận nội bộ để gắn vào lệnh chuyển."
                  : selectedBank
                    ? `${user?.displayName ?? "Tài khoản cá nhân"} • ${selectedBank.name} • ${selectedBank.accountNumber}`
                    : "Chưa có tài khoản nhận tiền để gắn vào lệnh rút."}
              </p>
              <p className="mt-3 text-xs leading-5 text-white/56">
                {isInternalWithdrawal
                  ? "Hệ thống dùng đúng ID người dùng làm số tài khoản nội bộ và xử lý tức thì sau khi bạn xác nhận OTP."
                  : "Trạng thái xác minh tài khoản được lấy từ backend. Chỉ tài khoản đã duyệt mới có thể tạo lệnh rút."}
              </p>
            </div>
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 bg-[linear-gradient(180deg,rgba(248,245,255,0),rgba(248,245,255,0.92)_18%,rgba(248,245,255,0.98)_100%)] pb-6 pt-6 backdrop-blur-xl dark:bg-[linear-gradient(180deg,rgba(18,8,29,0),rgba(18,8,29,0.92)_18%,rgba(18,8,29,0.98)_100%)]">
        <div className="mobile-page-shell">
          <div className="mb-3 flex items-center justify-between px-1">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8d84a1] dark:text-[#bdaaD6]">
                Thực nhận
              </p>
              <p className="mt-1 font-auth-headline text-xl font-bold text-[#2f2441] dark:text-white">
                {formatNumber(receivableAmount)} VND
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8d84a1] dark:text-[#bdaaD6]">
                Trạng thái
              </p>
              <p className={`mt-1 text-sm font-semibold ${readinessClassName}`}>
                {readinessLabel}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleStartWithdrawalVerification()}
            disabled={isVerificationBlocked}
            className={`flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 font-auth-headline text-base font-bold text-white transition-all duration-200 active:scale-[0.99] ${
              isVerificationBlocked
                ? "cursor-not-allowed bg-[#bfaed7] shadow-none dark:bg-[#46355d]"
                : "bg-gradient-primary shadow-[0_24px_48px_-28px_rgba(123,25,216,0.52)]"
            }`}
          >
            <ShieldCheck className="size-5" />
            {requestingVerificationStep ? "Đang gửi mã xác thực..." : verificationButtonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
