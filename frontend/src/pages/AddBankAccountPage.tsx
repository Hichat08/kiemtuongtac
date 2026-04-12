import { AppMobileNav } from "@/components/navigation/app-mobile-nav";
import { BankBrandMark } from "@/components/branding/bank-brand-mark";
import {
  additionalWithdrawalBanks,
  featuredWithdrawalBanks,
} from "@/lib/withdraw-bank-accounts";
import { userService } from "@/services/userService";
import { useAuthStore } from "@/stores/useAuthStore";
import axios from "axios";
import { ArrowLeft, BadgeCheck, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { toast } from "sonner";

const normalizeAccountHolder = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

const sanitizeAccountNumber = (value: string) => value.replace(/\D/g, "");

const formatBankChoiceLabel = (bankCode: string, bankName: string) =>
  bankCode === bankName ? bankCode : `${bankName} (${bankCode})`;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? fallback;
  }

  return fallback;
};

export default function AddBankAccountPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [selectedBankCode, setSelectedBankCode] = useState("MBB");
  const [showOtherBanks, setShowOtherBanks] = useState(false);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState(
    normalizeAccountHolder(user?.displayName ?? "")
  );
  const [branch, setBranch] = useState("");
  const [note, setNote] = useState("");
  const [primary, setPrimary] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const selectableBanks = useMemo(
    () => [...featuredWithdrawalBanks, ...additionalWithdrawalBanks],
    []
  );

  const selectedBank = useMemo(() => {
    return (
      featuredWithdrawalBanks.find((bank) => bank.code === selectedBankCode) ??
      additionalWithdrawalBanks.find((bank) => bank.code === selectedBankCode) ??
      featuredWithdrawalBanks[0]
    );
  }, [selectedBankCode]);

  const formError = useMemo(() => {
    if (!selectedBank) {
      return "Chọn ngân hàng nhận tiền.";
    }

    if (accountNumber.trim().length < 8) {
      return "Số tài khoản phải có ít nhất 8 chữ số.";
    }

    if (accountHolder.trim().length < 4) {
      return "Tên chủ tài khoản chưa hợp lệ.";
    }

    if (branch.trim().length < 2) {
      return "Vui lòng nhập chi nhánh ngân hàng.";
    }

    return "";
  }, [accountHolder, accountNumber, branch, selectedBank]);

  const handleAccountNumberChange = (event: ChangeEvent<HTMLInputElement>) => {
    setAccountNumber(sanitizeAccountNumber(event.target.value));
  };

  const handleAccountHolderChange = (event: ChangeEvent<HTMLInputElement>) => {
    setAccountHolder(normalizeAccountHolder(event.target.value));
  };

  const handleConfirm = async () => {
    if (!selectedBank || formError) {
      toast.error(formError || "Biểu mẫu chưa hợp lệ.");
      return;
    }

    try {
      setSubmitting(true);

      const res = await userService.submitBankAccountVerificationRequest({
        bankCode: selectedBank.code,
        bankName: selectedBank.name,
        accountNumber,
        accountHolder,
        branch: branch.trim(),
        note: note.trim(),
        primary,
      });

      toast.success(res.message || `Đã gửi yêu cầu xác minh tài khoản ${selectedBank.name}.`);
      navigate("/wallet/withdraw", {
        state: { newBankAccountId: res.account.id },
      });
    } catch (error) {
      console.error("Không gửi được yêu cầu xác minh tài khoản ngân hàng", error);
      toast.error(
        getErrorMessage(error, "Không gửi được yêu cầu xác minh tài khoản ngân hàng.")
      );
    } finally {
      setSubmitting(false);
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
    <>
      <div className="relative min-h-screen overflow-x-hidden bg-[#f8f5ff] font-auth-body text-slate-800 dark:bg-[#12081d] dark:text-slate-100">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,_rgba(123,25,216,0.16),_transparent_58%)] dark:bg-[radial-gradient(circle_at_top,_rgba(255,102,199,0.18),_transparent_60%)]" />
        <div className="pointer-events-none absolute right-[-5rem] top-24 size-56 rounded-full bg-[#ffd3f2]/68 blur-3xl dark:bg-[#7b19d8]/30" />
        <div className="pointer-events-none absolute left-[-4rem] top-64 size-48 rounded-full bg-[#cbe8ff]/34 blur-3xl dark:bg-[#3b2d68]/36" />

        <header className="sticky top-0 z-30 bg-[#f8f5ff]/84 backdrop-blur-xl dark:bg-[#12081d]/82">
          <div className="mobile-page-shell flex items-center justify-between pb-3 pt-5">
            <div className="flex items-center gap-3">
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
                <p className="font-auth-headline text-sm font-bold text-[#2d1459] dark:text-white">
                  Thêm tài khoản
                </p>
              </div>
            </div>

            <div className="rounded-full bg-white/86 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7b19d8] shadow-[0_16px_36px_-28px_rgba(123,25,216,0.45)] dark:bg-white/10 dark:text-[#ff84d1]">
              Secure
            </div>
          </div>
        </header>

        <main className="mobile-page-shell pb-56 pt-4">
          <section className="mt-3">
            <div className="relative overflow-hidden rounded-[2rem] bg-gradient-primary p-6 text-white shadow-[0_30px_80px_-35px_rgba(123,25,216,0.62)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.2),_transparent_24%),radial-gradient(circle_at_bottom_left,_rgba(255,255,255,0.12),_transparent_30%)]" />
              <div className="absolute -right-8 top-10 size-28 rounded-full bg-white/12 blur-2xl" />

              <div className="relative z-10">
                <div className="flex items-start justify-between gap-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/86">
                    <BadgeCheck className="size-3.5" />
                    Rút tiền an toàn
                  </div>
                  <div className="rounded-full bg-white/14 px-3 py-1 text-[11px] font-semibold text-white/86">
                    Duyệt thủ công
                  </div>
                </div>

                <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/72">
                  Tài khoản nhận thưởng
                </p>
                <h1 className="mt-3 max-w-sm font-auth-headline text-[2.3rem] font-extrabold leading-[1.04] tracking-[-0.05em] text-white">
                  Thêm tài khoản ngân hàng để rút tiền
                </h1>
                <p className="mt-3 max-w-sm text-sm leading-6 text-white/80">
                  Liên kết tài khoản nhận tiền của bạn. Sau khi admin xác minh, tài khoản này
                  sẽ dùng cho các giao dịch rút thưởng trong ví.
                </p>

                <div className="mt-6 flex items-center justify-between gap-3 rounded-[1.15rem] bg-white/10 px-4 py-3 backdrop-blur-sm">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/56">
                      Ngân hàng đang chọn
                    </p>
                    <p className="mt-1 font-auth-headline text-sm font-bold">
                      {selectedBank?.name ?? "Chưa chọn ngân hàng"}
                    </p>
                  </div>
                  <div className="rounded-full bg-white/12 px-3 py-1 text-[11px] font-semibold text-white/86">
                    {primary ? "Ưu tiên bật" : "Ưu tiên tắt"}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-8">
            <div className="px-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9a91aa] dark:text-[#d7c7ed]">
                Chọn ngân hàng
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {featuredWithdrawalBanks.map((bank) => {
                const active = bank.code === selectedBankCode;

                return (
                  <button
                    key={bank.code}
                    type="button"
                    onClick={() => setSelectedBankCode(bank.code)}
                    className={`rounded-[1.35rem] px-4 py-4 text-left transition-all duration-200 active:scale-[0.98] ${
                      active
                        ? "bg-white shadow-[0_24px_54px_-38px_rgba(123,25,216,0.3)] ring-2 ring-[#cfa9ff] dark:bg-white/10 dark:ring-[#7b19d8]"
                        : "bg-white/88 shadow-[0_18px_48px_-38px_rgba(123,25,216,0.2)] dark:bg-white/6"
                    }`}
                    aria-pressed={active}
                  >
                    <div className="overflow-hidden rounded-[1.1rem]">
                      <BankBrandMark
                        bankCode={bank.code}
                        bankName={bank.name}
                      />
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="rounded-full bg-[#f3eef9] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7b19d8] dark:bg-white/10 dark:text-[#ff84d1]">
                        {bank.code}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                          active
                            ? "bg-gradient-primary text-white shadow-[0_16px_32px_-20px_rgba(123,25,216,0.42)]"
                            : "bg-[#f6f1fc] text-[#8c77b0] dark:bg-white/10 dark:text-[#d7c7ed]"
                        }`}
                      >
                        {active ? "Đã chọn" : "Chọn ngay"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowOtherBanks((current) => !current)}
              className="mt-3 flex w-full items-center justify-between rounded-[1.1rem] bg-[#f3eef9] px-4 py-3 text-sm font-semibold text-[#6f6591] transition-colors hover:bg-[#eee7f8] dark:bg-white/8 dark:text-[#d7c7ed]"
            >
              <span>Xem thêm ngân hàng khác</span>
              <ChevronDown
                className={`size-4 transition-transform ${showOtherBanks ? "rotate-180" : ""}`}
              />
            </button>

            {showOtherBanks ? (
              <div className="mt-3 rounded-[1.2rem] bg-white/88 p-4 shadow-[0_18px_48px_-38px_rgba(123,25,216,0.22)] dark:bg-white/8">
                <select
                  value={selectedBankCode}
                  onChange={(event) => setSelectedBankCode(event.target.value)}
                  className="w-full rounded-[1rem] bg-[#f7f4ff] px-4 py-3 text-sm font-medium text-[#4b425f] outline-none dark:bg-white/8 dark:text-white"
                >
                  {selectableBanks.map((bank) => (
                    <option
                      key={bank.code}
                      value={bank.code}
                    >
                      {formatBankChoiceLabel(bank.code, bank.name)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </section>

          <section className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-2 block px-1 text-sm font-medium text-[#6f6591] dark:text-[#d7c7ed]">
                Số tài khoản
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={accountNumber}
                onChange={handleAccountNumberChange}
                placeholder="Nhập số tài khoản của bạn"
                className="w-full rounded-[1rem] bg-white/92 px-4 py-4 text-base text-[#2f2441] shadow-[0_16px_44px_-36px_rgba(123,25,216,0.22)] outline-none ring-1 ring-black/[0.03] placeholder:text-[#b5aec1] focus:ring-2 focus:ring-[#7b19d8]/28 dark:bg-white/8 dark:text-white dark:placeholder:text-[#8d7cab]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block px-1 text-sm font-medium text-[#6f6591] dark:text-[#d7c7ed]">
                Tên chủ tài khoản
              </span>
              <input
                type="text"
                value={accountHolder}
                onChange={handleAccountHolderChange}
                placeholder="Nhập đúng tên chủ tài khoản"
                className="w-full rounded-[1rem] bg-white/92 px-4 py-4 text-base font-medium uppercase text-[#2f2441] shadow-[0_16px_44px_-36px_rgba(123,25,216,0.22)] outline-none ring-1 ring-black/[0.03] placeholder:text-[#b5aec1] focus:ring-2 focus:ring-[#7b19d8]/28 dark:bg-white/8 dark:text-white dark:placeholder:text-[#8d7cab]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block px-1 text-sm font-medium text-[#6f6591] dark:text-[#d7c7ed]">
                Chi nhánh
              </span>
              <input
                type="text"
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
                placeholder="Ví dụ: CN Quận 1"
                className="w-full rounded-[1rem] bg-white/92 px-4 py-4 text-base text-[#2f2441] shadow-[0_16px_44px_-36px_rgba(123,25,216,0.22)] outline-none ring-1 ring-black/[0.03] placeholder:text-[#b5aec1] focus:ring-2 focus:ring-[#7b19d8]/28 dark:bg-white/8 dark:text-white dark:placeholder:text-[#8d7cab]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block px-1 text-sm font-medium text-[#6f6591] dark:text-[#d7c7ed]">
                Ghi chú <span className="text-[#9a91aa]">(Tùy chọn)</span>
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="Thêm ghi chú nếu cần đối soát đặc biệt"
                className="w-full resize-none rounded-[1rem] bg-white/92 px-4 py-4 text-base text-[#2f2441] shadow-[0_16px_44px_-36px_rgba(123,25,216,0.22)] outline-none ring-1 ring-black/[0.03] placeholder:text-[#b5aec1] focus:ring-2 focus:ring-[#7b19d8]/28 dark:bg-white/8 dark:text-white dark:placeholder:text-[#8d7cab]"
              />
            </label>

            <label className="flex items-center gap-3 rounded-[1rem] bg-[#f7f4ff] px-4 py-3 text-sm font-medium text-[#6f6591] dark:bg-white/8 dark:text-[#d7c7ed]">
              <input
                type="checkbox"
                checked={primary}
                onChange={(event) => setPrimary(event.target.checked)}
                className="size-4 rounded border-[#d9b7ff] text-[#7b19d8] focus:ring-[#7b19d8]/30"
              />
              Đặt làm tài khoản ưu tiên sau khi được xác minh
            </label>
          </section>

          <section className="mt-8 rounded-[1.4rem] border border-white/70 bg-[linear-gradient(135deg,rgba(123,25,216,0.08),rgba(255,132,209,0.14))] p-4 shadow-[0_18px_40px_-34px_rgba(123,25,216,0.18)] dark:border-white/8 dark:bg-[linear-gradient(135deg,rgba(123,25,216,0.18),rgba(255,132,209,0.12))]">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-white shadow-[0_18px_40px_-26px_rgba(123,25,216,0.42)]">
                <BadgeCheck className="size-4.5" />
              </div>

              <div>
                <p className="font-auth-headline text-sm font-bold text-[#7b19d8] dark:text-[#ff84d1]">
                  Ghi chú bảo mật
                </p>
                <p className="mt-2 text-sm leading-6 text-[#6b5b85] dark:text-[#d8c6f1]">
                  Vui lòng kiểm tra kỹ thông tin trước khi gửi. Tên chủ tài khoản phải trùng
                  khớp với tên trên hồ sơ ngân hàng để admin đối soát và xác minh.
                </p>
              </div>
            </div>
          </section>

          {formError ? (
            <p className="mt-4 px-1 text-sm font-medium text-[#d4525d] dark:text-[#ff9fb1]">
              {formError}
            </p>
          ) : null}

          <section className="mt-8 rounded-[1.45rem] border border-white/70 bg-white/88 p-4 shadow-[0_20px_55px_-40px_rgba(123,25,216,0.24)] dark:border-white/8 dark:bg-white/8">
            <div className="flex items-start gap-3">
              <BankBrandMark
                bankCode={selectedBank?.code}
                bankName={selectedBank?.name}
                compact
                className="h-16 w-36 shrink-0"
              />

              <div>
                <p className="font-auth-headline text-base font-bold text-slate-900 dark:text-white">
                  Ngân hàng đã chọn
                </p>
                <p className="mt-1 text-sm text-[#7e7691] dark:text-[#c8b5e8]">
                  {selectedBank?.name ?? "Chưa chọn ngân hàng"}
                </p>
                <p className="mt-1 text-xs text-[#9a91aa] dark:text-[#bdaaD6]">
                  Yêu cầu xác minh sẽ được chuyển sang admin. Chỉ tài khoản đã duyệt mới dùng để rút tiền.
                </p>
              </div>
            </div>
          </section>
        </main>

        <div className="fixed inset-x-0 bottom-[4.9rem] z-40 bg-[linear-gradient(180deg,rgba(248,245,255,0),rgba(248,245,255,0.92)_18%,rgba(248,245,255,0.98)_100%)] pb-4 pt-6 backdrop-blur-xl dark:bg-[linear-gradient(180deg,rgba(18,8,29,0),rgba(18,8,29,0.92)_18%,rgba(18,8,29,0.98)_100%)]">
          <div className="mobile-page-shell">
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={Boolean(formError) || submitting}
              className={`flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 font-auth-headline text-base font-bold text-white transition-all duration-200 active:scale-[0.99] ${
                formError || submitting
                  ? "cursor-not-allowed bg-[#bfaed7] shadow-none dark:bg-[#46355d]"
                  : "bg-gradient-primary shadow-[0_24px_48px_-28px_rgba(123,25,216,0.52)]"
              }`}
            >
              <BadgeCheck className="size-5" />
              {submitting ? "Đang gửi xác minh..." : "Gửi yêu cầu xác minh"}
            </button>
          </div>
        </div>

        <AppMobileNav />
      </div>
    </>
  );
}
