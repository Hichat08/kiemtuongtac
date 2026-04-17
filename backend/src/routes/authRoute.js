import express from "express";
import {
  refreshToken,
  requestPasswordReset,
  requestSignUpVerificationCode,
  resetPassword,
  signIn,
  signOut,
  signUp,
  verifyPasswordResetCode,
  verifyEmailCode,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/signup/request-code", requestSignUpVerificationCode);
router.post("/verify-email/request-code", requestSignUpVerificationCode);
router.post("/verify-email", verifyEmailCode);
router.post("/forgot-password", requestPasswordReset);
router.post("/forgot-password/verify-code", verifyPasswordResetCode);
router.post("/reset-password", resetPassword);
router.post("/signup", signUp);

router.post("/signin", signIn);

router.post("/signout", signOut);

router.post("/refresh", refreshToken);

export default router;
