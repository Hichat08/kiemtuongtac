import User from "../models/User.js";

const REFERRAL_PREFIX = "KTT-";

export const normalizeReferralCode = (value) =>
  `${value ?? ""}`.trim().replace(/\s+/g, "").toUpperCase();

export const buildReferralCodeFromAccountId = (accountId) => {
  const normalizedAccountId = `${accountId ?? ""}`.trim().replace(/^#/, "");

  if (!normalizedAccountId) {
    return "";
  }

  return normalizedAccountId;
};

const extractReferralLookup = (referralCode) => {
  const normalizedCode = normalizeReferralCode(referralCode);

  if (!normalizedCode) {
    return null;
  }

  const rawCode = normalizedCode.startsWith(REFERRAL_PREFIX)
    ? normalizedCode.slice(REFERRAL_PREFIX.length)
    : normalizedCode;

  const normalizedAccountId = rawCode.replace(/^#/, "");

  if (/^\d{8}$/.test(normalizedAccountId)) {
    return {
      accountId: normalizedAccountId,
    };
  }

  return {
    username: rawCode.toLowerCase(),
  };
};

export const resolveReferrerByReferralCode = async (referralCode, { excludeUserId } = {}) => {
  const referralLookup = extractReferralLookup(referralCode);

  if (!referralLookup) {
    return null;
  }

  const query = {
    role: { $ne: "admin" },
  };

  if (referralLookup.accountId) {
    query.accountId = referralLookup.accountId;
  } else if (referralLookup.username) {
    query.username = referralLookup.username;
  } else {
    return null;
  }

  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }

  return User.findOne(query);
};

export const serializeReferralInvitee = (user) => ({
  id: user._id.toString(),
  displayName: user.displayName ?? "",
  username: user.username ?? "",
  avatarUrl: user.avatarUrl ?? "",
  invitedAt: user.createdAt ? new Date(user.createdAt).toISOString() : null,
  status: user.emailVerified ? "verified" : "pending",
});
