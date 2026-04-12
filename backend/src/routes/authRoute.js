import express from "express";
import {
  googleAuthCallback,
  refreshToken,
  requestPasswordReset,
  requestSignUpVerificationCode,
  resetPassword,
  startGoogleAuth,
  signIn,
  signInWithGoogle,
  signOut,
  signUp,
  verifyPasswordResetCode,
  verifyEmailCode,
} from "../controllers/authController.js";

const router = express.Router();

router.get("/google/start", startGoogleAuth);
router.get("/google/callback", googleAuthCallback);
router.post("/signup/request-code", requestSignUpVerificationCode);
router.post("/verify-email/request-code", requestSignUpVerificationCode);
router.post("/verify-email", verifyEmailCode);
router.post("/forgot-password", requestPasswordReset);
router.post("/forgot-password/verify-code", verifyPasswordResetCode);
router.post("/reset-password", resetPassword);
router.post("/signup", signUp);

router.post("/google", signInWithGoogle);
router.post("/signin", signIn);

router.post("/signout", signOut);

router.post("/refresh", refreshToken);

export default router;
