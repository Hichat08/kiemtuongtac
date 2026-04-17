import axios from "axios";
import { create } from "zustand";
import { authService } from "@/services/authService";
import {
  clearLockedAccountSnapshot,
  persistLockedAccountSnapshot,
  redirectToAccountLockedPage,
} from "@/lib/account-lock";
import type { AuthState, SignUpPayload } from "@/types/store";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
import { useChatStore } from "./useChatStore";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message ?? fallback;
  }

  return fallback;
};

const handleLockedAccountError = (error: unknown) => {
  if (!axios.isAxiosError(error) || !error.response?.data?.accountLocked) {
    return false;
  }

  const responseData = error.response.data;

  persistLockedAccountSnapshot({
    message:
      responseData?.message ??
      "Tài khoản của bạn hiện đang bị khóa. Vui lòng liên hệ hỗ trợ để được kiểm tra.",
    note: responseData?.lockReason ?? "",
    lockedAt: responseData?.lockedAt ?? null,
  });
  redirectToAccountLockedPage();
  return true;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      loading: false,

      setAccessToken: (accessToken) => {
        set({ accessToken });
      },
      setUser: (user) => {
        clearLockedAccountSnapshot();
        set({ user });
      },
      clearState: () => {
        set({ accessToken: null, user: null, loading: false });
        useChatStore.getState().reset();
      },
      signUp: async (payload: SignUpPayload) => {
        try {
          set({ loading: true });

          const response = await authService.signUp(payload);

          if (response?.accessToken) {
            get().setAccessToken(response.accessToken);
            await get().fetchMe();
            void useChatStore.getState().fetchConversations();
          }

          toast.success("Đăng ký thành công.");
          return true;
        } catch (error) {
          console.error(error);
          toast.error(getErrorMessage(error, "Đăng ký không thành công."));
          return false;
        } finally {
          set({ loading: false });
        }
      },
      signIn: async (credential, password) => {
        try {
          get().clearState();
          set({ loading: true });

          const { accessToken, accountLocked, message, lockReason, lockedAt } =
            await authService.signIn(credential, password);
          get().setAccessToken(accessToken);

          await get().fetchMe();
          void useChatStore.getState().fetchConversations();

          if (accountLocked) {
            persistLockedAccountSnapshot({
              message:
                message ??
                "Tài khoản của bạn hiện đang bị khóa. Vui lòng liên hệ hỗ trợ để được kiểm tra.",
              note: lockReason ?? "",
              lockedAt: lockedAt ?? null,
            });
            redirectToAccountLockedPage();
            return false;
          }

          toast.success("Chào mừng bạn quay lại với Kiếm Tương Tác 🎉");
          return true;
        } catch (error) {
          console.error(error);
          if (handleLockedAccountError(error)) {
            return false;
          }
          toast.error(getErrorMessage(error, "Đăng nhập không thành công!"));
          return false;
        } finally {
          set({ loading: false });
        }
      },
      signInWithGoogle: async (googleAccessToken) => {
        try {
          get().clearState();
          set({ loading: true });

          const {
            accessToken,
            isNewUser,
            accountLocked,
            message,
            lockReason,
            lockedAt,
          } = await authService.signInWithGoogle(googleAccessToken);
          get().setAccessToken(accessToken);

          await get().fetchMe();
          void useChatStore.getState().fetchConversations();

          if (accountLocked) {
            persistLockedAccountSnapshot({
              message:
                message ??
                "Tài khoản của bạn hiện đang bị khóa. Vui lòng liên hệ hỗ trợ để được kiểm tra.",
              note: lockReason ?? "",
              lockedAt: lockedAt ?? null,
            });
            redirectToAccountLockedPage();
            return false;
          }

          toast.success(
            isNewUser
              ? "Tài khoản Google đã được tạo và đăng nhập thành công."
              : "Đăng nhập Google thành công.",
          );
          return true;
        } catch (error) {
          console.error(error);
          if (handleLockedAccountError(error)) {
            return false;
          }
          toast.error(
            getErrorMessage(error, "Đăng nhập Google không thành công."),
          );
          return false;
        } finally {
          set({ loading: false });
        }
      },
      signOut: async () => {
        try {
          clearLockedAccountSnapshot();
          get().clearState();
          await authService.signOut();
          toast.success("Logout thành công!");
        } catch (error) {
          console.error(error);
          toast.error("Lỗi xảy ra khi logout. Hãy thử lại!");
        }
      },
      fetchMe: async (options) => {
        try {
          if (!options?.silent) {
            set({ loading: true });
          }
          const user = await authService.fetchMe();

          clearLockedAccountSnapshot();
          set({ user });
        } catch (error) {
          console.error(error);
          if (handleLockedAccountError(error)) {
            return;
          }
          if (
            axios.isAxiosError(error) &&
            [401, 403, 404].includes(error.response?.status ?? 0)
          ) {
            set({ user: null, accessToken: null });
          }
          if (!options?.silent) {
            toast.error("Lỗi xảy ra khi lấy dữ liệu người dùng. Hãy thử lại!");
          }
        } finally {
          if (!options?.silent) {
            set({ loading: false });
          }
        }
      },
      refresh: async () => {
        try {
          set({ loading: true });
          const { user, fetchMe, setAccessToken } = get();
          const refreshResponse = await authService.refresh();
          const refreshPayload =
            typeof refreshResponse === "string"
              ? { accessToken: refreshResponse }
              : (refreshResponse ?? {});
          const { accessToken, accountLocked, message, lockReason, lockedAt } =
            refreshPayload;

          if (!accessToken) {
            throw new Error("Không nhận được access token mới.");
          }

          setAccessToken(accessToken);

          if (!user) {
            await fetchMe();
          }

          if (accountLocked) {
            const currentPath =
              typeof window !== "undefined" ? window.location.pathname : "";

            persistLockedAccountSnapshot({
              message:
                message ??
                "Tài khoản của bạn hiện đang bị khóa. Vui lòng liên hệ hỗ trợ để được kiểm tra.",
              note: lockReason ?? "",
              lockedAt: lockedAt ?? null,
            });
            if (
              currentPath !== "/chat/support" &&
              currentPath !== "/account-locked"
            ) {
              redirectToAccountLockedPage();
              return;
            }
          }
        } catch (error) {
          console.error(error);
          if (handleLockedAccountError(error)) {
            return;
          }
          toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!");
          get().clearState();
        } finally {
          set({ loading: false });
        }
      },
      // Deprecated: Email verification is now skipped during signup
      requestSignUpCode: async (_email: string) => {
        return { success: false };
      },
      verifyEmail: async (_email: string, _code: string) => {
        return false;
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ user: state.user }), // chỉ persist user
    },
  ),
);
