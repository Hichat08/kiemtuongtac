import api from "@/lib/axios";
import type { SignUpPayload } from "@/types/store";

export const authService = {
  requestPasswordReset: async (email: string) => {
    const res = await api.post(
      "/auth/forgot-password",
      { email },
      { withCredentials: true }
    );

    return res.data;
  },

  resetPassword: async (token: string, password: string) => {
    const res = await api.post(
      "/auth/reset-password",
      { token, password },
      { withCredentials: true }
    );

    return res.data;
  },

  verifyPasswordResetCode: async (email: string, code: string) => {
    const res = await api.post(
      "/auth/forgot-password/verify-code",
      { email, code },
      { withCredentials: true }
    );

    return res.data;
  },

  requestSignUpCode: async (email: string) => {
    const res = await api.post(
      "/auth/verify-email/request-code",
      { email },
      { withCredentials: true }
    );

    return res.data;
  },

  verifyEmail: async (email: string, code: string) => {
    const res = await api.post(
      "/auth/verify-email",
      { email, code },
      { withCredentials: true }
    );

    return res.data;
  },

  signUp: async (payload: SignUpPayload) => {
    const res = await api.post("/auth/signup", payload, { withCredentials: true });

    return res.data;
  },

  signIn: async (credential: string, password: string) => {
    const res = await api.post(
      "/auth/signin",
      { credential, username: credential, password },
      { withCredentials: true }
    );
    return res.data; // access token
  },

  signInWithGoogle: async (accessToken: string) => {
    const res = await api.post(
      "/auth/google",
      { accessToken },
      { withCredentials: true }
    );

    return res.data;
  },

  signOut: async () => {
    return api.post("/auth/signout", null, { withCredentials: true });
  },

  fetchMe: async () => {
    const res = await api.get("/users/me", { withCredentials: true });
    return res.data.user;
  },

  refresh: async () => {
    const res = await api.post("/auth/refresh", null, { withCredentials: true });
    return res.data;
  },
};
