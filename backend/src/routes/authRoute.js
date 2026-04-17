import express from "express";
import {
  refreshToken,
  requestPasswordReset,
  resetPassword,
  signIn,
  signOut,
  signUp,
  verifyPasswordResetCode,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/forgot-password", requestPasswordReset);
router.post("/forgot-password/verify-code", verifyPasswordResetCode);
router.post("/reset-password", resetPassword);
router.post("/signup", signUp);

router.post("/signin", signIn);

router.post("/signout", signOut);

router.post("/refresh", refreshToken);

export default router;
