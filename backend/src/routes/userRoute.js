import express from "express";
import {
  authMe,
  getDepositReceivingAccount,
  getInternalTransferRecipient,
  getLockStatus,
  getMyBankAccounts,
  getMyNotificationSettings,
  getMyReferralOverview,
  searchUserByUsername,
  submitBankAccountVerificationRequest,
  updateMyNotificationSettings,
  updateMyProfile,
  uploadAvatar,
  regenerateRegistrationPin,
} from "../controllers/userController.js";
import { getUserFinanceSettings } from "../controllers/financeSettingsController.js";
import { taskProofUpload, upload } from "../middlewares/uploadMiddleware.js";

import {
  createDepositRequest as createUserDepositRequest,
  createWithdrawalRequest as createUserWithdrawalRequest,
  getMyDepositRequest as getUserDepositRequest,
  getMyFinancialOverview as getUserFinancialOverview,
  getMyHomeOverview as getUserHomeOverview,
  getMyWithdrawalRequest as getUserWithdrawalRequest,
  requestWithdrawalVerificationCode as requestUserWithdrawalVerificationCode,
} from "../controllers/financeController.js";
import {
  getUserTaskHistory,
  getUserBroadcastNotifications,
  getUserTaskDetail,
  getUserTasks,
  submitUserTaskSubmission,
} from "../controllers/engagementController.js";

const router = express.Router();

router.get("/me", authMe);
router.get("/lock-status", getLockStatus);
router.patch("/me", updateMyProfile);
router.get("/notification-settings", getMyNotificationSettings);
router.patch("/notification-settings", updateMyNotificationSettings);
router.post("/registration-pin/regenerate", regenerateRegistrationPin);
router.get("/bank-accounts", getMyBankAccounts);
router.get("/referrals", getMyReferralOverview);
router.get("/deposit-account", getDepositReceivingAccount);
router.get("/finance-settings", getUserFinanceSettings);
router.get("/financial-overview", getUserFinancialOverview);
router.get("/home-overview", getUserHomeOverview);
router.get("/broadcast-notifications", getUserBroadcastNotifications);
router.get("/task-submissions", getUserTaskHistory);
router.get("/tasks", getUserTasks);
router.get("/tasks/:id", getUserTaskDetail);
router.post(
  "/tasks/:id/submissions",
  taskProofUpload.single("screenshot"),
  submitUserTaskSubmission,
);
router.post("/deposit-requests", createUserDepositRequest);
router.get("/deposit-requests/:id", getUserDepositRequest);
router.post(
  "/withdrawal-requests/request-code",
  requestUserWithdrawalVerificationCode,
);
router.post("/withdrawal-requests", createUserWithdrawalRequest);
router.get("/withdrawal-requests/:id", getUserWithdrawalRequest);
router.get("/internal-transfer-recipient", getInternalTransferRecipient);
router.get("/search", searchUserByUsername);
router.post(
  "/bank-accounts/verification-request",
  submitBankAccountVerificationRequest,
);
router.post("/uploadAvatar", upload.single("file"), uploadAvatar);

export default router;
