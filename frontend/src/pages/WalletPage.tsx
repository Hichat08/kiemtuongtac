import { AppMobileNav } from "@/components/navigation/app-mobile-nav";
import NotificationCenterDialog from "@/components/profile/NotificationCenterDialog";
import { useUserFinancialData } from "@/hooks/useUserFinancialData";
import { useUserNotificationSummary } from "@/hooks/useUserNotificationSummary";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Clock3,
  Gift,
  ShieldAlert,
  Sparkles,
  Wallet,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";

const formatCurrency = (value: number) =>
  `${new Intl.NumberFormat("vi-VN").format(value)}đ`;

const getTransactionVisual = (transaction: {
  kind: "deposit" | "withdrawal" | "adjustment";
  status: "pending" | "approved" | "rejected";
  direction: "credit" | "debit";
  reasonCode?: string;
  withdrawalType?: "bank" | "internal";
}) => {
  if (transaction.status === "rejected") {
    return {
      icon: XCircle,
      iconClassName: "bg-[#fff0f2] text-[#d4525d]",
      amountClassName: "text-[#d4525d]",
    };
  }

  if (transaction.status === "pending") {
    return {
      icon: Clock3,
      iconClassName: "bg-[#f3eef9] text-[#7b19d8]",
      amountClassName: "text-[#7b19d8]",
    };
  }

  if (transaction.kind === "deposit") {
    return {
      icon: ArrowDownLeft,
      iconClassName: "bg-[#eaf2ff] text-[#1b5fd5]",
      amountClassName: "text-[#00a46f]",
    };
  }

  if (transaction.kind === "withdrawal") {
    return transaction.withdrawalType === "internal"
      ? {
          icon: ArrowUpRight,
          iconClassName: "bg-[#f3edff] text-[#7b19d8]",
          amountClassName: "text-[#7b19d8]",
        }
      : {
          icon: ArrowUpRight,
          iconClassName: "bg-[#fff5ea] text-[#d17b00]",
          amountClassName: "text-[#c26100]",
        };
  }

  switch (transaction.reasonCode) {
    case "community_gift_send":
    case "community_gift_claim":
      return {
        icon: Gift,
        iconClassName: "bg-[#fff0f5] text-[#d8589f]",
        amountClassName: transaction.direction === "credit" ? "text-[#00a46f]" : "text-[#d8589f]",
      };
    case "task_submission_reward":
      return {
        icon: BadgeCheck,
        iconClassName: "bg-[#eefbf4] text-[#00a46f]",
        amountClassName: "text-[#00a46f]",
      };
    case "internal_transfer_in":
      return {
        icon: ArrowDownLeft,
        iconClassName: "bg-[#eaf2ff] text-[#1b5fd5]",
        amountClassName: "text-[#00a46f]",
      };
    case "fraud_balance_clear":
      return {
        icon: ShieldAlert,
        iconClassName: "bg-[#fff0f2] text-[#b31b25]",
        amountClassName: transaction.direction === "credit" ? "text-[#00a46f]" : "text-[#b31b25]",
      };
    default:
      return {
        icon: Sparkles,
        iconClassName:
          transaction.direction === "credit"
            ? "bg-[#eefbf4] text-[#00a46f]"
            : "bg-[#fff5ea] text-[#d17b00]",
        amountClassName: transaction.direction === "credit" ? "text-[#00a46f]" : "text-[#c26100]",
      };
  }
};

const WalletPage = () => {
  const { user } = useAuthStore();
  const {
    currentBalance,
    pendingTotal,
    settledTotal,
    transactions: timelineItems,
  } = useUserFinancialData(user?.accountId);
  const { unreadCount } = useUserNotificationSummary();
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [showAllTransactions, setShowAllTransactions] = useState(false);

  const transactions = useMemo(
    () =>
      timelineItems.map((transaction) => {
        const isAdjustment = transaction.kind === "adjustment";
        const isCredit = transaction.direction === "credit";
        const visual = getTransactionVisual(transaction);

        return {
          id: transaction.id,
          title: transaction.title,
          detail: transaction.detail,
          time: transaction.timeLabel,
          amount: `${isCredit ? "+" : "-"}${formatCurrency(transaction.amount).replace("đ", "")}`,
          icon: visual.icon,
          iconClassName: visual.iconClassName,
          amountClassName: visual.amountClassName,
          detailClassName: isAdjustment
            ? "text-[#7b728f] dark:text-[#c7bddb]"
            : "text-[#8d84a1] dark:text-[#bdaaD6]",
        };
      }),
    [timelineItems]
  );
  const visibleTransactions = useMemo(
    () => (showAllTransactions ? transactions : transactions.slice(0, 3)),
    [showAllTransactions, transactions]
  );
  const hiddenTransactionCount = Math.max(transactions.length - 3, 0);

  return (
    <>
      <div className="relative min-h-screen overflow-x-hidden bg-[#f8f5ff] font-auth-body text-slate-800 dark:bg-[#12081d] dark:text-slate-100">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(123,25,216,0.16),_transparent_58%)] dark:bg-[radial-gradient(circle_at_top,_rgba(255,102,199,0.18),_transparent_60%)]" />
        <div className="pointer-events-none absolute right-[-5rem] top-20 h-56 w-56 rounded-full bg-[#ffd3f2]/70 blur-3xl dark:bg-[#7b19d8]/30" />

        <header className="sticky top-0 z-30">
          <div className="mobile-page-shell flex items-center justify-between pb-3 pt-5 backdrop-blur-xl">
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-primary text-white shadow-[0_18px_35px_-24px_rgba(123,25,216,0.55)]">
                <Wallet className="size-4.5" />
              </div>
              <div>
                <p className="font-auth-headline text-lg font-extrabold tracking-tight text-[#2d1459] dark:text-white">
                  Ví của tôi
                </p>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9b79cb] dark:text-[#d9b7ff]">
                  {user?.displayName ?? "Tài khoản cá nhân"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setNotificationCenterOpen(true)}
              className="relative flex size-10 items-center justify-center rounded-full bg-white/82 text-slate-500 shadow-[0_16px_40px_-26px_rgba(123,25,216,0.45)] backdrop-blur-xl transition-transform duration-200 active:scale-95 dark:bg-white/10 dark:text-slate-100"
              aria-label="Mở thông báo"
            >
              <Bell className="size-4" />
              {unreadCount > 0 ? (
                <>
                  <span className="absolute right-2 top-2 size-2 rounded-full bg-[#ff4a90] ring-2 ring-[#f8f5ff] dark:ring-[#12081d]" />
                  <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-[#ff4a90] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                </>
              ) : null}
            </button>
          </div>
        </header>

        <main className="mobile-page-shell pb-32 pt-3 sm:pb-36 sm:pt-4">
          <section className="space-y-5 sm:space-y-6">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#978bb0] dark:text-[#cbb9e7]">
                Số dư hiện tại
              </p>
              <h1 className="mobile-fluid-display font-auth-headline font-extrabold tracking-[-0.05em] text-slate-900 dark:text-white">
                {new Intl.NumberFormat("vi-VN").format(currentBalance)}{" "}
                <span className="text-xl text-[#00c88b] sm:text-2xl">VND</span>
              </h1>
            </div>

            <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-4">
              <Link
                to="/wallet/withdraw"
                className="flex items-center justify-center gap-2 rounded-full bg-gradient-primary px-4 py-3.5 font-auth-headline text-sm font-bold text-white shadow-[0_18px_36px_-24px_rgba(123,25,216,0.55)] transition-transform duration-200 active:scale-95 sm:px-5 sm:py-4 sm:text-base"
              >
                <ArrowUpRight className="size-4.5" />
                Rút tiền
              </Link>

              <Link
                to="/wallet/deposit"
                className="flex items-center justify-center gap-2 rounded-full bg-white/88 px-4 py-3.5 font-auth-headline text-sm font-bold text-[#5a4e73] shadow-[0_18px_36px_-28px_rgba(123,25,216,0.32)] ring-1 ring-black/[0.04] transition-transform duration-200 active:scale-95 dark:bg-white/8 dark:text-[#d5c5ec] sm:px-5 sm:py-4 sm:text-base"
              >
                <ArrowDownLeft className="size-4.5 text-[#1b5fd5]" />
                Nạp tiền
              </Link>
            </div>
          </section>

          <section className="mt-7 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:mt-8 sm:gap-4">
            <div className="rounded-[1.6rem] bg-[#f2effa] p-4 dark:bg-white/8 sm:rounded-[2rem] sm:p-5">
              <div className="mb-4 flex size-9 items-center justify-center rounded-full bg-[#dff5ff] text-[#33a4d8] sm:mb-5 sm:size-10">
                <Clock3 className="size-4 sm:size-4.5" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9a91aa]">
                Đang chờ duyệt
              </p>
              <p className="mobile-fluid-metric mt-2 font-auth-headline font-extrabold tracking-[-0.05em] text-slate-900 dark:text-white">
                {formatCurrency(pendingTotal)}
              </p>
            </div>

            <div className="rounded-[1.6rem] bg-[#f2effa] p-4 dark:bg-white/8 sm:rounded-[2rem] sm:p-5">
              <div className="mb-4 flex size-9 items-center justify-center rounded-full bg-[#dff7ec] text-[#00c88b] sm:mb-5 sm:size-10">
                <BadgeCheck className="size-4 sm:size-4.5" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9a91aa]">
                Đã phát sinh
              </p>
              <p className="mobile-fluid-metric mt-2 font-auth-headline font-extrabold tracking-[-0.05em] text-slate-900 dark:text-white">
                {formatCurrency(settledTotal)}
              </p>
            </div>
          </section>

          <section className="mt-8 space-y-4 sm:mt-10 sm:space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-auth-headline text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                Lịch sử giao dịch
              </h2>
              <span className="text-sm font-bold text-[#7b19d8] dark:text-[#ff84d1]">
                {transactions.length} giao dịch
              </span>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {transactions.length ? (
                visibleTransactions.map((transaction) => {
                  const Icon = transaction.icon;

                  return (
                    <div
                      key={transaction.id}
                      className="flex items-center gap-3 rounded-[1.4rem] bg-white/88 px-4 py-3.5 shadow-[0_20px_55px_-40px_rgba(123,25,216,0.34)] backdrop-blur-2xl dark:bg-white/8 sm:gap-4 sm:rounded-[1.6rem] sm:p-4"
                    >
                      <div
                        className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${transaction.iconClassName} sm:size-12 sm:rounded-2xl`}
                      >
                        <Icon className="size-4.5 sm:size-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          {transaction.title}
                        </h3>
                        <p className={`mt-0.5 text-xs ${transaction.detailClassName}`}>
                          {transaction.detail}
                        </p>
                        <p className="mt-1 text-[11px] text-[#8d84a1] dark:text-[#bdaaD6]">
                          {transaction.time}
                        </p>
                      </div>

                      <p
                        className={`font-auth-headline text-base font-extrabold tracking-tight sm:text-lg ${transaction.amountClassName}`}
                      >
                        {transaction.amount}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[1.6rem] bg-white/88 px-5 py-8 text-center shadow-[0_20px_55px_-40px_rgba(123,25,216,0.34)] backdrop-blur-2xl dark:bg-white/8">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#f3eef9] text-[#7b19d8] dark:bg-white/10 dark:text-[#ff84d1]">
                    <XCircle className="size-5" />
                  </div>
                  <h3 className="mt-4 font-auth-headline text-lg font-bold text-slate-900 dark:text-white">
                    Chưa có giao dịch nào
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#8d84a1] dark:text-[#bdaaD6]">
                    Mọi biến động ví như nạp tiền, rút tiền, gửi quà, nhận quà và các điều chỉnh khác sẽ xuất hiện đầy đủ tại đây.
                  </p>
                </div>
              )}

              {hiddenTransactionCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowAllTransactions((currentValue) => !currentValue)}
                  className="flex w-full items-center justify-center rounded-[1.3rem] border border-[#eadffd] bg-[#faf7ff] px-4 py-3 text-sm font-bold text-[#7b19d8] transition-transform duration-200 active:scale-[0.985] dark:border-white/10 dark:bg-white/6 dark:text-[#ff84d1]"
                >
                  {showAllTransactions
                    ? "Thu gọn lịch sử giao dịch"
                    : `Xem tất cả ${transactions.length} giao dịch`}
                </button>
              ) : null}
            </div>
          </section>

          <section className="relative mt-8 overflow-hidden rounded-[1.8rem] bg-gradient-primary p-5 text-white shadow-[0_30px_80px_-35px_rgba(123,25,216,0.62)] sm:mt-10 sm:rounded-[2.1rem] sm:p-6">
            <div className="pointer-events-none absolute -right-8 top-0 h-28 w-28 rounded-full bg-white/14 blur-3xl" />
            <div className="pointer-events-none absolute bottom-[-2rem] left-[-1rem] h-28 w-28 rounded-full bg-[#ffb3e5]/22 blur-3xl" />
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0))]" />
            <div className="relative z-10">
              <h3 className="font-auth-headline text-2xl font-extrabold tracking-[-0.05em] sm:text-3xl">
                Bắt đầu giao dịch thật
              </h3>
              <p className="mt-2.5 max-w-xs text-[13px] leading-6 text-white/82 sm:mt-3 sm:text-sm sm:leading-7">
                Nạp tiền vào ví hoặc thêm tài khoản nhận tiền để toàn bộ biến động được đồng bộ tại đây.
              </p>
              <Link
                to="/wallet/deposit"
                className="mt-4 inline-flex rounded-full bg-white px-5 py-2.5 font-auth-headline text-xs font-bold uppercase tracking-[0.16em] text-[#7b19d8] shadow-[0_18px_36px_-26px_rgba(15,23,42,0.35)] transition-transform duration-200 active:scale-95 sm:mt-5 sm:px-6 sm:py-3 sm:text-sm"
              >
                Nạp tiền ngay
              </Link>
            </div>
          </section>
        </main>

        <AppMobileNav />
      </div>

      {notificationCenterOpen ? (
        <NotificationCenterDialog
          open={notificationCenterOpen}
          setOpen={setNotificationCenterOpen}
        />
      ) : null}
    </>
  );
};

export default WalletPage;
