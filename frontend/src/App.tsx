import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { Toaster } from "sonner";

import AccountRoute from "./components/auth/AccountRoute";
import ModerationWarningDialog from "./components/auth/ModerationWarningDialog";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { FloatingChatShortcut } from "./components/navigation/floating-chat-shortcut";
import { LoadingSpinner } from "./components/ui/loading-spinner";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import { useAuthStore } from "./stores/useAuthStore";
import { useSocketStore } from "./stores/useSocketStore";
import { useThemeStore } from "./stores/useThemeStore";

const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ForgotPasswordOtpPage = lazy(() => import("./pages/ForgotPasswordOtpPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const ResetPasswordSuccessPage = lazy(() => import("./pages/ResetPasswordSuccessPage"));
const AccountLockedPage = lazy(() => import("./pages/AccountLockedPage"));

const HomePage = lazy(() => import("./pages/HomePage"));
const ChatAppPage = lazy(() => import("./pages/ChatAppPage"));
const SupportChatPage = lazy(() => import("./pages/SupportChatPage"));
const TasksPage = lazy(() => import("./pages/TasksPage"));
const TaskDetailPage = lazy(() => import("./pages/TaskDetailPage"));
const WalletPage = lazy(() => import("./pages/WalletPage"));
const DepositPage = lazy(() => import("./pages/DepositPage"));
const DepositPaymentPage = lazy(() => import("./pages/DepositPaymentPage"));
const DepositPendingPage = lazy(() => import("./pages/DepositPendingPage"));
const DepositSuccessPage = lazy(() => import("./pages/DepositSuccessPage"));
const WithdrawPage = lazy(() => import("./pages/WithdrawPage"));
const WithdrawalVerifyPage = lazy(() => import("./pages/WithdrawalVerifyPage"));
const AddBankAccountPage = lazy(() => import("./pages/AddBankAccountPage"));
const WithdrawalPendingPage = lazy(() => import("./pages/WithdrawalPendingPage"));
const WithdrawalSuccessPage = lazy(() => import("./pages/WithdrawalSuccessPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));

const AdminPage = lazy(() => import("./pages/AdminPage"));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage"));
const AdminTasksPage = lazy(() => import("./pages/AdminTasksPage"));
const AdminSupportPage = lazy(() => import("./pages/AdminSupportPage"));
const AdminCommunityPage = lazy(() => import("./pages/AdminCommunityPage"));
const AdminEventsPromotionsPage = lazy(() => import("./pages/AdminEventsPromotionsPage"));
const AdminBroadcastNotificationsPage = lazy(
  () => import("./pages/AdminBroadcastNotificationsPage")
);
const AdminDepositsPage = lazy(() => import("./pages/AdminDepositsPage"));
const AdminDepositAccountsPage = lazy(() => import("./pages/AdminDepositAccountsPage"));
const AdminBankAccountsPage = lazy(() => import("./pages/AdminBankAccountsPage"));
const AdminWithdrawalsPage = lazy(() => import("./pages/AdminWithdrawalsPage"));
const AdminSettingsPage = lazy(() => import("./pages/AdminSettingsPage"));
const AdminSettingsGeneralPage = lazy(() => import("./pages/AdminSettingsGeneralPage"));
const AdminSettingsFinancePage = lazy(() => import("./pages/AdminSettingsFinancePage"));
const AdminSettingsTasksPage = lazy(() => import("./pages/AdminSettingsTasksPage"));
const AdminSettingsSecurityPage = lazy(() => import("./pages/AdminSettingsSecurityPage"));

const preloadUserRoutes = () => {
  void import("./pages/ChatAppPage");
  void import("./pages/SupportChatPage");
  void import("./pages/TasksPage");
  void import("./pages/WalletPage");
  void import("./pages/WithdrawPage");
  void import("./pages/ProfilePage");
};

const preloadAdminRoutes = () => {
  void import("./pages/AdminPage");
  void import("./pages/AdminUsersPage");
  void import("./pages/AdminTasksPage");
  void import("./pages/AdminWithdrawalsPage");
};

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f5ff] px-6 dark:bg-[#12081d]">
      <div className="flex flex-col items-center gap-4 rounded-[1.7rem] bg-white/88 px-8 py-7 shadow-[0_24px_60px_-40px_rgba(123,25,216,0.22)] backdrop-blur-xl dark:bg-white/8">
        <LoadingSpinner />
        <p className="text-sm font-medium text-[#726a83] dark:text-[#c8b5e8]">
          Đang tải trang...
        </p>
      </div>
    </div>
  );
}

function App() {
  const { isDark, setTheme } = useThemeStore();
  const { accessToken, user, fetchMe, setAccessToken } = useAuthStore();
  const { connectSocket, disconnectSocket } = useSocketStore();

  useEffect(() => {
    setTheme(isDark);
  }, [isDark, setTheme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    const accessTokenParam = url.searchParams.get("access_token");

    if (accessTokenParam) {
      setAccessToken(accessTokenParam);
      url.searchParams.delete("access_token");
      window.history.replaceState({}, "", url.toString());
    }
  }, [setAccessToken]);

  useEffect(() => {
    if (!accessToken) {
      disconnectSocket();
      return;
    }

    connectSocket();

    return () => disconnectSocket();
  }, [accessToken, connectSocket, disconnectSocket]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const preloadTimer = window.setTimeout(() => {
      if (user?.role === "admin") {
        preloadAdminRoutes();
        return;
      }

      preloadUserRoutes();
    }, 1200);

    return () => window.clearTimeout(preloadTimer);
  }, [accessToken, user?.role]);

  useEffect(() => {
    if (!accessToken || user?.role === "admin") {
      return;
    }

    let active = true;

    const syncCurrentUser = async () => {
      if (!active) {
        return;
      }

      await fetchMe({ silent: true });
    };

    void syncCurrentUser();

    const handleWindowFocus = () => {
      void syncCurrentUser();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncCurrentUser();
      }
    };

    const intervalId = window.setInterval(() => {
      void syncCurrentUser();
    }, 30_000);

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [accessToken, fetchMe, user?.role]);

  return (
    <>
      <Toaster richColors />
      <BrowserRouter>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route
              path="/signin"
              element={<SignInPage />}
            />
            <Route
              path="/signup"
              element={<SignUpPage />}
            />
            <Route
              path="/verify-email"
              element={<VerifyEmailPage />}
            />
            <Route
              path="/forgot-password"
              element={<ForgotPasswordPage />}
            />
            <Route
              path="/forgot-password/verify"
              element={<ForgotPasswordOtpPage />}
            />
            <Route
              path="/reset-password"
              element={<ResetPasswordPage />}
            />
            <Route
              path="/reset-password/success"
              element={<ResetPasswordSuccessPage />}
            />
            <Route
              path="/account-locked"
              element={<AccountLockedPage />}
            />

            <Route element={<ProtectedRoute />}>
              <Route
                path="/"
                element={<HomePage />}
              />
              <Route
                path="/chat"
                element={<ChatAppPage />}
              />
              <Route
                path="/chat/support"
                element={<SupportChatPage />}
              />
              <Route
                path="/tasks"
                element={<TasksPage />}
              />
              <Route
                path="/tasks/:taskId"
                element={<TaskDetailPage />}
              />
              <Route
                path="/wallet"
                element={<WalletPage />}
              />
              <Route
                path="/wallet/deposit"
                element={<DepositPage />}
              />
              <Route
                path="/wallet/deposit/payment"
                element={<DepositPaymentPage />}
              />
              <Route
                path="/wallet/deposit/pending/:requestId"
                element={<DepositPendingPage />}
              />
              <Route
                path="/wallet/deposit/success/:requestId"
                element={<DepositSuccessPage />}
              />
              <Route
                path="/wallet/withdraw"
                element={<WithdrawPage />}
              />
              <Route
                path="/wallet/withdraw/verify"
                element={<WithdrawalVerifyPage />}
              />
              <Route
                path="/wallet/withdraw/add-bank"
                element={<AddBankAccountPage />}
              />
              <Route
                path="/wallet/withdraw/pending/:requestId"
                element={<WithdrawalPendingPage />}
              />
              <Route
                path="/wallet/withdraw/success/:requestId"
                element={<WithdrawalSuccessPage />}
              />
              <Route
                path="/account"
                element={<AccountRoute />}
              />
              <Route
                path="/profile"
                element={<ProfilePage />}
              />
            </Route>

            <Route element={<ProtectedRoute requireAdmin />}>
              <Route
                path="/admin"
                element={<AdminPage />}
              />
              <Route
                path="/admin/users"
                element={<AdminUsersPage />}
              />
              <Route
                path="/admin/tasks"
                element={<AdminTasksPage />}
              />
              <Route
                path="/admin/support"
                element={<AdminSupportPage />}
              />
              <Route
                path="/admin/community"
                element={<AdminCommunityPage />}
              />
              <Route
                path="/admin/community/gifts/new"
                element={
                  <Navigate
                    to="/admin/community"
                    replace
                  />
                }
              />
              <Route
                path="/admin/events-promotions"
                element={<AdminEventsPromotionsPage />}
              />
              <Route
                path="/admin/broadcast-notifications"
                element={<AdminBroadcastNotificationsPage />}
              />
              <Route
                path="/admin/deposits"
                element={<AdminDepositsPage />}
              />
              <Route
                path="/admin/deposit-accounts"
                element={<AdminDepositAccountsPage />}
              />
              <Route
                path="/admin/bank-accounts"
                element={<AdminBankAccountsPage />}
              />
              <Route
                path="/admin/withdrawals"
                element={<AdminWithdrawalsPage />}
              />
              <Route
                path="/admin/settings"
                element={<AdminSettingsPage />}
              />
              <Route
                path="/admin/settings/general"
                element={<AdminSettingsGeneralPage />}
              />
              <Route
                path="/admin/settings/finance"
                element={<AdminSettingsFinancePage />}
              />
              <Route
                path="/admin/settings/tasks"
                element={<AdminSettingsTasksPage />}
              />
              <Route
                path="/admin/settings/security"
                element={<AdminSettingsSecurityPage />}
              />
            </Route>
          </Routes>
          <ModerationWarningDialog />
        </Suspense>
        <FloatingChatShortcut />
      </BrowserRouter>
    </>
  );
}

export default App;
