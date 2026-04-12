import express from "express";
import {
  clearAdminUserWalletBalance,
  createAdminDepositAccount,
  getAdminBankAccounts,
  getAdminCommunityReports,
  getAdminNavigationIndicators,
  getAdminDepositAccounts,
  getAdminOverview,
  getAdminUserDetail,
  getAdminUsers,
  setPrimaryAdminDepositAccount,
  updateAdminUserCommunityChat,
  updateAdminCommunityReportStatus,
  updateAdminDepositAccount,
  updateAdminDepositAccountStatus,
  updateAdminBankAccountStatus,
  updateAdminUserModeration,
} from "../controllers/adminController.js";
import { adminOnly } from "../middlewares/adminMiddleware.js";
import {
  getAdminDepositRequests,
  getAdminWithdrawalRequests,
  updateAdminDepositRequestStatus,
  updateAdminWithdrawalRequestStatus,
} from "../controllers/financeController.js";
import {
  createAdminBroadcastNotification,
  createAdminCampaign,
  createAdminTask,
  deleteAdminCampaign,
  deleteAdminTask,
  getAdminBroadcastNotifications,
  getAdminCampaigns,
  getAdminTaskSubmissions,
  getAdminTasks,
  reviewAdminTaskSubmission,
  updateAdminCampaign,
  updateAdminCampaignStatus,
  updateAdminTask,
  updateAdminTaskStatus,
} from "../controllers/engagementController.js";
import {
  getAdminFinanceSettings,
  updateAdminFinanceSettings,
} from "../controllers/financeSettingsController.js";

const router = express.Router();

router.use(adminOnly);
router.get("/overview", getAdminOverview);
router.get("/navigation-indicators", getAdminNavigationIndicators);
router.get("/settings/finance", getAdminFinanceSettings);
router.patch("/settings/finance", updateAdminFinanceSettings);
router.get("/users", getAdminUsers);
router.get("/users/:id", getAdminUserDetail);
router.patch("/users/:id/moderation", updateAdminUserModeration);
router.patch("/users/:id/community-chat", updateAdminUserCommunityChat);
router.post("/users/:id/wallet/clear-balance", clearAdminUserWalletBalance);
router.get("/broadcast-notifications", getAdminBroadcastNotifications);
router.post("/broadcast-notifications", createAdminBroadcastNotification);
router.get("/campaigns", getAdminCampaigns);
router.post("/campaigns", createAdminCampaign);
router.patch("/campaigns/:id", updateAdminCampaign);
router.patch("/campaigns/:id/status", updateAdminCampaignStatus);
router.delete("/campaigns/:id", deleteAdminCampaign);
router.get("/tasks", getAdminTasks);
router.get("/task-submissions", getAdminTaskSubmissions);
router.get("/community-reports", getAdminCommunityReports);
router.post("/tasks", createAdminTask);
router.patch("/tasks/:id", updateAdminTask);
router.patch("/tasks/:id/status", updateAdminTaskStatus);
router.delete("/tasks/:id", deleteAdminTask);
router.patch("/task-submissions/:id/review", reviewAdminTaskSubmission);
router.patch("/community-reports/:id/status", updateAdminCommunityReportStatus);
router.get("/bank-accounts", getAdminBankAccounts);
router.patch("/bank-accounts/:id/status", updateAdminBankAccountStatus);
router.get("/deposit-requests", getAdminDepositRequests);
router.patch("/deposit-requests/:id/status", updateAdminDepositRequestStatus);
router.get("/deposit-accounts", getAdminDepositAccounts);
router.post("/deposit-accounts", createAdminDepositAccount);
router.patch("/deposit-accounts/:id", updateAdminDepositAccount);
router.patch("/deposit-accounts/:id/primary", setPrimaryAdminDepositAccount);
router.patch("/deposit-accounts/:id/status", updateAdminDepositAccountStatus);
router.get("/withdrawal-requests", getAdminWithdrawalRequests);
router.patch("/withdrawal-requests/:id/status", updateAdminWithdrawalRequestStatus);

export default router;
