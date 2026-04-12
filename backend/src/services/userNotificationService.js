import User from "../models/User.js";
import {
  buildAdminBroadcastEmail,
  buildFinancialRequestStatusEmail,
  buildModerationStatusEmail,
  buildWalletAdjustmentEmail,
  isMailConfigured,
  sendEmail,
} from "./mailService.js";

const dayMs = 24 * 60 * 60 * 1000;
const EMAIL_BATCH_SIZE = 25;

const normalizeEmail = (value) => `${value ?? ""}`.trim();
const normalizeDisplayName = (value) => `${value ?? ""}`.trim() || "Người dùng";

const logBackgroundTaskError = (label, error) => {
  console.error(`Lỗi khi xử lý nền cho ${label}`, error);
};

const queueBackgroundTask = (label, task) => {
  Promise.resolve()
    .then(task)
    .catch((error) => logBackgroundTaskError(label, error));
};

const canReceiveEmail = (user) =>
  Boolean(user) &&
  user.role !== "admin" &&
  Boolean(normalizeEmail(user.email)) &&
  isMailConfigured();

const loadUserById = async (userId) => {
  if (!userId) {
    return null;
  }

  return User.findById(userId)
    .select("displayName email accountId role warningCount moderationNote lastWarnedAt lockedAt updatedAt")
    .lean();
};

const getBroadcastAudienceQuery = (audience, now = new Date()) => {
  const baseQuery = {
    role: { $ne: "admin" },
  };

  if (audience === "verified") {
    return {
      ...baseQuery,
      emailVerified: true,
    };
  }

  if (audience === "new_7d") {
    return {
      ...baseQuery,
      createdAt: {
        $gte: new Date(now.getTime() - dayMs * 7),
      },
    };
  }

  return baseQuery;
};

const sendEmailsInBatches = async (entries) => {
  for (let index = 0; index < entries.length; index += EMAIL_BATCH_SIZE) {
    const chunk = entries.slice(index, index + EMAIL_BATCH_SIZE);

    await Promise.allSettled(
      chunk.map(({ to, payload }) =>
        sendEmail({
          to,
          ...payload,
        })
      )
    );
  }
};

export const queueFinancialRequestStatusEmail = ({ requestType, request, user = null }) => {
  queueBackgroundTask(
    `${requestType === "deposit" ? "duyet nap" : "duyet rut"} ${request?.requestCode ?? ""}`,
    async () => {
      const targetUser = user ?? (await loadUserById(request?.userId));

      if (!canReceiveEmail(targetUser) || !request?.status) {
        return;
      }

      const payload = buildFinancialRequestStatusEmail({
        displayName: normalizeDisplayName(targetUser.displayName ?? request.userDisplayName),
        requestType,
        status: request.status,
        requestCode: request.requestCode ?? "",
        amount: Number(request.amount ?? 0),
        bonusAmount: Number(request.bonusAmount ?? 0),
        totalAmount: Number(request.amount ?? 0),
        receivableAmount: Number(request.receivableAmount ?? 0),
        methodTitle: request.methodTitle ?? "",
        bankName: request.bankName ?? "",
        accountNumber: request.bankAccount ?? request.accountNumber ?? "",
        processedNote: request.processedNote ?? request.note ?? "",
        requestedAt: request.requestedAt ?? request.createdAt ?? null,
        processedAt:
          request.processedAt ?? request.approvedAt ?? request.rejectedAt ?? request.updatedAt ?? null,
      });

      await sendEmail({
        to: normalizeEmail(targetUser.email),
        ...payload,
      });
    }
  );
};

export const queueWalletAdjustmentEmail = ({ adjustment, user = null }) => {
  queueBackgroundTask(`bien dong vi ${adjustment?._id ?? ""}`, async () => {
    const targetUser = user ?? (await loadUserById(adjustment?.userId));

    if (!canReceiveEmail(targetUser) || !adjustment) {
      return;
    }

    const payload = buildWalletAdjustmentEmail({
      displayName: normalizeDisplayName(targetUser.displayName ?? adjustment.userDisplayName),
      accountId: targetUser.accountId ?? adjustment.userAccountId ?? "",
      direction: adjustment.direction,
      amount: Number(adjustment.amount ?? 0),
      reasonLabel: adjustment.reasonLabel ?? "",
      note: adjustment.note ?? "",
      effectiveAt: adjustment.effectiveAt ?? adjustment.createdAt ?? new Date(),
    });

    await sendEmail({
      to: normalizeEmail(targetUser.email),
      ...payload,
    });
  });
};

export const queueModerationStatusEmail = ({ user = null, userId = null, action, note = "" }) => {
  queueBackgroundTask(`moderation ${action ?? "update"} ${userId ?? user?._id ?? ""}`, async () => {
    const targetUser = user ?? (await loadUserById(userId));

    if (!canReceiveEmail(targetUser) || !action) {
      return;
    }

    const resolvedNote = `${note ?? ""}`.trim() || `${targetUser.moderationNote ?? ""}`.trim();

    const payload = buildModerationStatusEmail({
      displayName: normalizeDisplayName(targetUser.displayName),
      action,
      note: resolvedNote,
      warningCount: Number(targetUser.warningCount ?? 0),
      effectiveAt:
        targetUser.lockedAt ??
        targetUser.lastWarnedAt ??
        targetUser.updatedAt ??
        new Date(),
    });

    await sendEmail({
      to: normalizeEmail(targetUser.email),
      ...payload,
    });
  });
};

export const queueAdminBroadcastEmails = ({ notification, now = new Date() }) => {
  queueBackgroundTask(`broadcast ${notification?._id ?? notification?.title ?? ""}`, async () => {
    if (!notification || !isMailConfigured()) {
      return;
    }

    const users = await User.find(getBroadcastAudienceQuery(notification.audience, now))
      .select("displayName email role")
      .lean();

    const deliverableEntries = users
      .filter(canReceiveEmail)
      .map((user) => ({
        to: normalizeEmail(user.email),
        payload: buildAdminBroadcastEmail({
          displayName: normalizeDisplayName(user.displayName),
          title: notification.title ?? "Thông báo từ quản trị",
          content: notification.content ?? "",
          type: notification.type ?? "system",
          sentAt: notification.sentAt ?? now,
        }),
      }));

    if (!deliverableEntries.length) {
      return;
    }

    await sendEmailsInBatches(deliverableEntries);
  });
};
