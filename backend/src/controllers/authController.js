// @ts-nocheck
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import Session from "../models/Session.js";
import User from "../models/User.js";
import EmailVerification from "../models/EmailVerification.js";
import {
  buildLoginAlertEmail,
  buildPasswordResetOtpEmail,
  buildSignUpVerificationEmail,
  buildWelcomeEmail,
  isMailConfigured,
  sendEmail,
} from "../services/mailService.js";
import {
  normalizeReferralCode,
  resolveReferrerByReferralCode,
} from "../utils/referralHelper.js";

const ACCESS_TOKEN_TTL = "30m"; // thuờng là dưới 15m
const REFRESH_TOKEN_TTL = 14 * 24 * 60 * 60 * 1000; // 14 ngày
const SIGNUP_CODE_TTL_MS = 10 * 60 * 1000;
const SIGNUP_CODE_COOLDOWN_MS = 60 * 1000;
const SIGNUP_CODE_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_CODE_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_CODE_COOLDOWN_MS = 60 * 1000;
const PASSWORD_RESET_CODE_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_TOKEN_TTL_SECONDS = 15 * 60;
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_TOKENINFO_URL = "https://www.googleapis.com/oauth2/v3/tokeninfo";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const GOOGLE_STATE_COOKIE = "google_oauth_state";
const GOOGLE_REFERRAL_COOKIE = "google_oauth_referral";

const normalizeText = (value = "") => value.trim().replace(/\s+/g, " ");
const normalizeCredential = (value = "") => normalizeText(value).toLowerCase();

const getLockedAccountMessage = (user) => {
  const note = normalizeText(user?.moderationNote || "");

  return note
    ? `Tài khoản của bạn hiện đang bị khóa. ${note}`
    : "Tài khoản của bạn hiện đang bị khóa. Vui lòng liên hệ admin để được hỗ trợ.";
};

const buildLockedAccountPayload = (user) => ({
  message: getLockedAccountMessage(user),
  accountLocked: true,
  lockReason: normalizeText(user?.moderationNote || ""),
  lockedAt: user?.lockedAt ? new Date(user.lockedAt).toISOString() : null,
});

const ensureUserCanAccessApp = (user) => {
  if (user?.role !== "admin" && user?.moderationStatus === "locked") {
    return getLockedAccountMessage(user);
  }

  return "";
};

const createUsernameSeed = (value = "") =>
  normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 24);

const ensureUniqueUsername = async (preferred) => {
  const fallback = `kiemtuongtac.${crypto.randomBytes(3).toString("hex")}`;
  const base = createUsernameSeed(preferred) || fallback;
  let candidate = base;
  let suffix = 1;

  while (await User.exists({ username: candidate })) {
    const tail = `.${suffix}`;
    candidate = `${base.slice(0, Math.max(3, 24 - tail.length))}${tail}`;
    suffix += 1;
  }

  return candidate;
};

const createAccessToken = (userId) =>
  jwt.sign(
    { userId },
    // @ts-ignore
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );

const getPasswordResetSecret = () =>
  normalizeText(process.env.PASSWORD_RESET_SECRET || "") ||
  // @ts-ignore
  process.env.ACCESS_TOKEN_SECRET;

const createVerificationCode = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
const hashVerificationCode = (code) =>
  crypto.createHash("sha256").update(code).digest("hex");
const createPasswordResetFingerprint = (user) =>
  crypto
    .createHash("sha256")
    .update(
      String(
        user?.hashedPassword ||
          user?.googleId ||
          user?.updatedAt?.toISOString?.() ||
          user?._id ||
          ""
      )
    )
    .digest("hex");
const createPasswordResetToken = (user) => {
  const secret = getPasswordResetSecret();

  if (!secret) {
    throw new Error("Thiếu secret để tạo token khôi phục mật khẩu.");
  }

  return jwt.sign(
    {
      userId: user._id.toString(),
      purpose: "password-reset",
      fingerprint: createPasswordResetFingerprint(user),
    },
    secret,
    { expiresIn: PASSWORD_RESET_TOKEN_TTL_SECONDS }
  );
};

const getForwardedIp = (forwarded) => {
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0];
  }

  return "";
};

const getClientIp = (req) =>
  getForwardedIp(req.headers["x-forwarded-for"]) ||
  req.ip ||
  req.socket?.remoteAddress ||
  "Không xác định";

const getUserAgent = (req) => normalizeText(req.get("user-agent") || "Không xác định");
const isSecureRequest = (req) =>
  req.secure ||
  req.get("x-forwarded-proto") === "https" ||
  normalizeText(process.env.CLIENT_URL || "").startsWith("https://");

const getAuthCookieOptions = (req, overrides = {}) => {
  const secure = isSecureRequest(req);

  return {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    path: "/",
    ...overrides,
  };
};

const getGoogleCallbackUrl = () => {
  const configuredCallbackUrl = normalizeText(process.env.GOOGLE_CALLBACK_URL || "");

  if (configuredCallbackUrl) {
    return configuredCallbackUrl;
  }

  const port = normalizeText(process.env.PORT || "5001");
  return `http://localhost:${port}/api/auth/google/callback`;
};

const getMissingGoogleStartConfig = () => {
  const missing = [];

  if (!normalizeText(process.env.GOOGLE_CLIENT_ID || "")) {
    missing.push("GOOGLE_CLIENT_ID");
  }

  if (!getGoogleCallbackUrl()) {
    missing.push("GOOGLE_CALLBACK_URL");
  }

  return missing;
};
const getClientUrl = (path = "") => {
  const clientUrl = normalizeText(process.env.CLIENT_URL || "");

  if (!clientUrl) {
    return path || "/";
  }

  return path ? `${clientUrl}${path}` : clientUrl;
};
const getRoleHomePath = (role) => (role === "admin" ? "/admin" : "/");

const verifyPasswordResetToken = (token) => {
  const secret = getPasswordResetSecret();

  if (!secret) {
    throw new Error("Thiếu secret để xác minh token khôi phục mật khẩu.");
  }

  return jwt.verify(token, secret);
};

const mergeAuthProvider = (user, provider) => {
  const providers = new Set(Array.isArray(user.authProviders) ? user.authProviders : []);
  providers.add(provider);
  user.authProviders = [...providers];
};

const isLocalAccount = (user) =>
  !Array.isArray(user.authProviders) || user.authProviders.length === 0
    ? Boolean(user.hashedPassword)
    : user.authProviders.includes("local");

const sendEmailInBackground = (payload) => {
  if (!isMailConfigured()) {
    return;
  }

  void sendEmail(payload).catch((error) => {
    console.error("Lỗi khi gửi email nền", error);
  });
};

const sendAccountVerificationCode = async (user) => {
  if (!user?._id || !user.email) {
    throw new Error("Thiếu thông tin user để gửi mã xác minh.");
  }

  if (!isMailConfigured()) {
    throw new Error("Email server chưa được cấu hình. Vui lòng bổ sung SMTP trong backend/.env.");
  }

  const now = new Date();
  const existingCode = await EmailVerification.findOne({
    email: user.email,
    purpose: "signup",
  });

  if (existingCode?.resendAvailableAt > now) {
    return {
      sent: false,
      resendAfter: Math.ceil((existingCode.resendAvailableAt.getTime() - now.getTime()) / 1000),
      expiresIn: Math.max(1, Math.ceil((existingCode.expiresAt.getTime() - now.getTime()) / 1000)),
    };
  }

  const verificationCode = createVerificationCode();
  const verificationRecord = await EmailVerification.findOneAndUpdate(
    { email: user.email, purpose: "signup" },
    {
      userId: user._id,
      email: user.email,
      purpose: "signup",
      codeHash: hashVerificationCode(verificationCode),
      expiresAt: new Date(Date.now() + SIGNUP_CODE_TTL_MS),
      resendAvailableAt: new Date(Date.now() + SIGNUP_CODE_COOLDOWN_MS),
      attempts: 0,
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  try {
    await sendEmail({
      to: user.email,
      ...buildSignUpVerificationEmail({
        code: verificationCode,
        expiresInMinutes: Math.round(SIGNUP_CODE_TTL_MS / 60000),
      }),
    });
  } catch (error) {
    if (verificationRecord) {
      await verificationRecord.deleteOne();
    }

    throw error;
  }

  return {
    sent: true,
    resendAfter: Math.round(SIGNUP_CODE_COOLDOWN_MS / 1000),
    expiresIn: Math.round(SIGNUP_CODE_TTL_MS / 1000),
  };
};

const sendPasswordResetCode = async (user) => {
  if (!user?._id || !user.email) {
    throw new Error("Thiếu thông tin user để gửi mã đặt lại mật khẩu.");
  }

  if (!isMailConfigured()) {
    throw new Error("Email server chưa được cấu hình. Vui lòng bổ sung SMTP trong backend/.env.");
  }

  const now = new Date();
  const existingCode = await EmailVerification.findOne({
    email: user.email,
    purpose: "password_reset",
  });

  if (existingCode?.resendAvailableAt > now) {
    return {
      sent: false,
      resendAfter: Math.ceil((existingCode.resendAvailableAt.getTime() - now.getTime()) / 1000),
      expiresIn: Math.max(
        1,
        Math.ceil((existingCode.expiresAt.getTime() - now.getTime()) / 1000)
      ),
    };
  }

  const verificationCode = createVerificationCode();
  const verificationRecord = await EmailVerification.findOneAndUpdate(
    { email: user.email, purpose: "password_reset" },
    {
      userId: user._id,
      email: user.email,
      purpose: "password_reset",
      codeHash: hashVerificationCode(verificationCode),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_CODE_TTL_MS),
      resendAvailableAt: new Date(Date.now() + PASSWORD_RESET_CODE_COOLDOWN_MS),
      attempts: 0,
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  try {
    await sendEmail({
      to: user.email,
      ...buildPasswordResetOtpEmail({
        displayName: user.displayName,
        code: verificationCode,
        expiresInMinutes: Math.round(PASSWORD_RESET_CODE_TTL_MS / 60000),
      }),
    });
  } catch (error) {
    if (verificationRecord) {
      await verificationRecord.deleteOne();
    }

    throw error;
  }

  return {
    sent: true,
    resendAfter: Math.round(PASSWORD_RESET_CODE_COOLDOWN_MS / 1000),
    expiresIn: Math.round(PASSWORD_RESET_CODE_TTL_MS / 1000),
  };
};

const issueSession = async (req, res, userId) => {
  const accessToken = createAccessToken(userId);
  const refreshToken = crypto.randomBytes(64).toString("hex");

  await Session.create({
    userId,
    refreshToken,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL),
  });

  res.cookie("refreshToken", refreshToken, getAuthCookieOptions(req, {
    maxAge: REFRESH_TOKEN_TTL,
  }));

  return accessToken;
};

const recordSuccessfulLogin = async ({ req, user, provider, isNewUser = false }) => {
  mergeAuthProvider(user, provider);
  user.lastLoginAt = new Date();
  user.lastLoginIp = getClientIp(req);
  user.lastLoginUserAgent = getUserAgent(req);
  await user.save();

  const signedInAt = user.lastLoginAt.toLocaleString("vi-VN", { timeZone: "Asia/Saigon" });

  sendEmailInBackground(
    Object.assign(
      buildLoginAlertEmail({
        displayName: user.displayName,
        provider: provider === "google" ? "Google" : "Mật khẩu",
        ipAddress: user.lastLoginIp,
        userAgent: user.lastLoginUserAgent,
        signedInAt,
      }),
      { to: user.email }
    )
  );
};

const finalizeLogin = async ({ req, res, user, provider, isNewUser = false }) => {
  const blockedMessage = ensureUserCanAccessApp(user);

  if (blockedMessage) {
    const accessToken = await issueSession(req, res, user._id);
    return res.status(200).json({
      ...buildLockedAccountPayload(user),
      accessToken,
    });
  }

  await recordSuccessfulLogin({ req, user, provider, isNewUser });
  const accessToken = await issueSession(req, res, user._id);

  return res.status(200).json({
    message: `User ${user.displayName} đã logged in!`,
    accessToken,
    isNewUser,
  });
};

const exchangeGoogleAuthorizationCode = async (code) => {
  const googleClientId = normalizeText(process.env.GOOGLE_CLIENT_ID || "");
  const googleClientSecret = normalizeText(process.env.GOOGLE_CLIENT_SECRET || "");
  const redirectUri = getGoogleCallbackUrl();

  if (!googleClientId || !googleClientSecret || !redirectUri) {
    throw new Error(
      "Google OAuth callback chưa được cấu hình đầy đủ trên backend: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET hoặc GOOGLE_CALLBACK_URL."
    );
  }

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: googleClientId,
      client_secret: googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(await tokenRes.text());
  }

  return tokenRes.json();
};

const fetchGoogleProfile = async (accessToken) => {
  const googleClientId = normalizeText(process.env.GOOGLE_CLIENT_ID || "");

  if (!googleClientId) {
    throw new Error("Google auth chưa được cấu hình trên backend.");
  }

  const tokenInfoRes = await fetch(
    `${GOOGLE_TOKENINFO_URL}?access_token=${encodeURIComponent(accessToken)}`
  );

  if (!tokenInfoRes.ok) {
    throw new Error("Google token không hợp lệ.");
  }

  const tokenInfo = await tokenInfoRes.json();

  if (tokenInfo.aud !== googleClientId) {
    throw new Error("Google token không dành cho ứng dụng này.");
  }

  const profileRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!profileRes.ok) {
    throw new Error("Không lấy được hồ sơ Google.");
  }

  const profile = await profileRes.json();
  const email = normalizeCredential(profile.email);
  const emailVerified =
    profile.email_verified === true || profile.email_verified === "true";

  if (!email || !emailVerified) {
    throw new Error("Tài khoản Google chưa có email đã xác minh.");
  }

  return {
    email,
    googleId: normalizeText(profile.sub),
    displayName: normalizeText(profile.name) || email.split("@")[0],
    avatarUrl: normalizeText(profile.picture),
  };
};

const findOrCreateGoogleUser = async (googleProfile, { referralCode = "" } = {}) => {
  let user = await User.findOne({
    $or: [{ googleId: googleProfile.googleId }, { email: googleProfile.email }],
  });
  let isNewUser = false;

  if (!user) {
    const normalizedReferralCode = normalizeReferralCode(referralCode);
    const referrer = normalizedReferralCode
      ? await resolveReferrerByReferralCode(normalizedReferralCode)
      : null;

    if (normalizedReferralCode && !referrer) {
      const referralError = new Error("Mã giới thiệu không hợp lệ.");
      referralError.code = "INVALID_REFERRAL_CODE";
      referralError.referralCode = normalizedReferralCode;
      throw referralError;
    }

    const username = await ensureUniqueUsername(
      createUsernameSeed(googleProfile.email.split("@")[0]) ||
        createUsernameSeed(googleProfile.displayName)
    );

    user = await User.create({
      username,
      email: googleProfile.email,
      displayName: googleProfile.displayName,
      avatarUrl: googleProfile.avatarUrl || undefined,
      googleId: googleProfile.googleId,
      emailVerified: false,
      authProviders: ["google"],
      referredBy: referrer?._id ?? null,
      referralCodeUsed: referrer ? normalizedReferralCode : "",
    });
    isNewUser = true;
  } else {
    user.googleId = googleProfile.googleId || user.googleId;
    user.displayName = user.displayName || googleProfile.displayName;

    if (!user.avatarUrl && googleProfile.avatarUrl) {
      user.avatarUrl = googleProfile.avatarUrl;
    }

    await user.save();
  }

  return { user, isNewUser };
};

export const startGoogleAuth = async (req, res) => {
  try {
    const googleClientId = normalizeText(process.env.GOOGLE_CLIENT_ID || "");
    const redirectUri = getGoogleCallbackUrl();
    const missing = getMissingGoogleStartConfig();
    const referralCode = normalizeReferralCode(req.query?.ref);

    if (missing.length > 0) {
      return res.status(500).json({
        message: `Google OAuth chưa được cấu hình đầy đủ trên backend: ${missing.join(", ")}`,
      });
    }

    const state = crypto.randomBytes(24).toString("hex");
    res.cookie(
      GOOGLE_STATE_COOKIE,
      state,
      getAuthCookieOptions(req, {
        maxAge: 10 * 60 * 1000,
      })
    );

    if (referralCode) {
      res.cookie(
        GOOGLE_REFERRAL_COOKIE,
        referralCode,
        getAuthCookieOptions(req, {
          maxAge: 10 * 60 * 1000,
        })
      );
    } else {
      res.clearCookie(GOOGLE_REFERRAL_COOKIE, getAuthCookieOptions(req));
    }

    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account",
      state,
    });

    return res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  } catch (error) {
    console.error("Lỗi khi bắt đầu Google OAuth", error);
    return res.status(500).json({ message: "Không thể bắt đầu đăng nhập Google." });
  }
};

export const googleAuthCallback = async (req, res) => {
  try {
    const code = normalizeText(req.query?.code || "");
    const state = normalizeText(req.query?.state || "");
    const oauthError = normalizeText(req.query?.error || "");
    const storedState = normalizeText(req.cookies?.[GOOGLE_STATE_COOKIE] || "");
    const referralCode = normalizeReferralCode(req.cookies?.[GOOGLE_REFERRAL_COOKIE] || "");

    res.clearCookie(GOOGLE_STATE_COOKIE, getAuthCookieOptions(req));
    res.clearCookie(GOOGLE_REFERRAL_COOKIE, getAuthCookieOptions(req));

    if (oauthError) {
      return res.redirect(getClientUrl(`/signin?google_error=${encodeURIComponent(oauthError)}`));
    }

    if (!code || !state || !storedState || state !== storedState) {
      return res.redirect(getClientUrl("/signin?google_error=state_mismatch"));
    }

    const tokenData = await exchangeGoogleAuthorizationCode(code);
    const googleProfile = await fetchGoogleProfile(tokenData.access_token);
    const { user, isNewUser } = await findOrCreateGoogleUser(googleProfile, {
      referralCode,
    });

    if (!user.emailVerified) {
      await sendAccountVerificationCode(user);
      return res.redirect(
        getClientUrl(`/verify-email?email=${encodeURIComponent(user.email)}`)
      );
    }

    if (ensureUserCanAccessApp(user)) {
      const payload = buildLockedAccountPayload(user);
      const accessToken = await issueSession(req, res, user._id);

      const query = new URLSearchParams();
      query.set("lock", "1");
      query.set("access_token", accessToken);
      if (payload.lockedAt) {
        query.set("locked_at", payload.lockedAt);
      }
      if (payload.lockReason) {
        query.set("note", payload.lockReason.slice(0, 300));
      }
      if (payload.message) {
        query.set("message", payload.message.slice(0, 300));
      }

      return res.redirect(getClientUrl(`/account-locked?${query.toString()}`));
    }

    await recordSuccessfulLogin({ req, user, provider: "google", isNewUser });
    const accessToken = await issueSession(req, res, user._id);

    const nextUrl = new URL(getClientUrl(getRoleHomePath(user.role)));
    nextUrl.searchParams.set("access_token", accessToken);

    return res.redirect(nextUrl.toString());
  } catch (error) {
    console.error("Lỗi ở Google OAuth callback", error);

    if (error?.code === "INVALID_REFERRAL_CODE") {
      const query = new URLSearchParams({
        google_error: "invalid_referral",
      });

      if (error?.referralCode) {
        query.set("ref", error.referralCode);
      }

      return res.redirect(getClientUrl(`/signup?${query.toString()}`));
    }

    return res.redirect(getClientUrl("/signin?google_error=callback_failed"));
  }
};

export const requestSignUpVerificationCode = async (req, res) => {
  try {
    const email = normalizeCredential(req.body?.email);

    if (!email) {
      return res.status(400).json({ message: "Thiếu email để gửi mã xác minh." });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản cần xác minh." });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: "Tài khoản này đã được xác minh email." });
    }

    const result = await sendAccountVerificationCode(user);

    if (!result.sent) {
      return res.status(429).json({
        message: `Vui lòng đợi ${result.resendAfter}s trước khi gửi lại mã.`,
      });
    }

    return res.status(200).json({
      message: "Mã xác minh đã được gửi tới email của bạn.",
      expiresIn: result.expiresIn,
      resendAfter: result.resendAfter,
    });
  } catch (error) {
    console.error("Lỗi khi gửi mã xác minh đăng ký", error);
    return res.status(500).json({
      message: error.message || "Không gửi được mã xác minh qua email.",
    });
  }
};

export const signUp = async (req, res) => {
  try {
    if (!isMailConfigured()) {
      return res.status(503).json({
        message: "Email server chưa được cấu hình. Vui lòng bổ sung SMTP trong backend/.env.",
      });
    }

    const {
      username: rawUsername,
      password,
      email: rawEmail,
      firstName: rawFirstName,
      lastName: rawLastName,
      fullName: rawFullName,
      referralCode: rawReferralCode,
    } = req.body;

    const email = normalizeCredential(rawEmail);
    const fullName = normalizeText(rawFullName);
    const firstName = normalizeText(rawFirstName);
    const lastName = normalizeText(rawLastName);
    const displayName = fullName || [lastName, firstName].filter(Boolean).join(" ").trim();
    const referralCode = normalizeReferralCode(rawReferralCode);

    if (!password || !email || !displayName) {
      return res.status(400).json({
        message: "Không thể thiếu email, password và họ tên hiển thị",
      });
    }

    const duplicateEmail = await User.findOne({ email });

    if (duplicateEmail) {
      return res.status(409).json({ message: "email đã tồn tại" });
    }

    const preferredUsername =
      createUsernameSeed(rawUsername) ||
      createUsernameSeed(email.split("@")[0]) ||
      createUsernameSeed(displayName);

    if (rawUsername && (await User.findOne({ username: preferredUsername }))) {
      return res.status(409).json({ message: "username đã tồn tại" });
    }

    const username = rawUsername
      ? preferredUsername
      : await ensureUniqueUsername(preferredUsername);
    const referrer = referralCode
      ? await resolveReferrerByReferralCode(referralCode)
      : null;

    if (referralCode && !referrer) {
      return res.status(400).json({ message: "Mã giới thiệu không hợp lệ." });
    }

    // mã hoá password
    const hashedPassword = await bcrypt.hash(password, 10); // salt = 10

    // tạo user mới
    const user = await User.create({
      username,
      hashedPassword,
      email,
      displayName,
      emailVerified: false,
      authProviders: ["local"],
      referredBy: referrer?._id ?? null,
      referralCodeUsed: referrer ? referralCode : "",
    });

    try {
      await sendAccountVerificationCode(user);
    } catch (error) {
      await User.deleteOne({ _id: user._id });
      throw error;
    }

    // return
    return res.status(201).json({
      username,
      displayName,
      email,
      requiresVerification: true,
    });
  } catch (error) {
    console.error("Lỗi khi gọi signUp", error);
    return res.status(500).json({ message: error.message || "Lỗi hệ thống" });
  }
};

export const verifyEmailCode = async (req, res) => {
  try {
    const email = normalizeCredential(req.body?.email);
    const code = normalizeText(req.body?.code);

    if (!email || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: "Thiếu email hoặc mã xác minh 6 số." });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản cần xác minh." });
    }

    if (user.emailVerified) {
      const accessToken = await issueSession(req, res, user._id);
      return res.status(200).json({
        message: "Tài khoản đã được xác minh trước đó.",
        accessToken,
      });
    }

    const emailVerification = await EmailVerification.findOne({
      email,
      purpose: "signup",
    });

    if (!emailVerification) {
      return res.status(400).json({
        message: "Không tìm thấy mã xác minh còn hiệu lực. Vui lòng gửi lại mã.",
      });
    }

    if (emailVerification.expiresAt < new Date()) {
      await emailVerification.deleteOne();
      return res.status(400).json({ message: "Mã xác minh đã hết hạn." });
    }

    const isCodeCorrect = emailVerification.codeHash === hashVerificationCode(code);

    if (!isCodeCorrect) {
      emailVerification.attempts += 1;

      if (emailVerification.attempts >= SIGNUP_CODE_MAX_ATTEMPTS) {
        await emailVerification.deleteOne();
        return res.status(429).json({
          message: "Bạn nhập sai mã quá nhiều lần. Vui lòng yêu cầu mã mới.",
        });
      }

      await emailVerification.save();
      return res.status(400).json({ message: "Mã xác minh không chính xác." });
    }

    user.emailVerified = true;
    await user.save();
    await emailVerification.deleteOne();

    sendEmailInBackground(
      Object.assign(buildWelcomeEmail({ displayName: user.displayName }), {
        to: user.email,
      })
    );

    await recordSuccessfulLogin({
      req,
      user,
      provider: isLocalAccount(user) ? "local" : "google",
    });
    const accessToken = await issueSession(req, res, user._id);

    return res.status(200).json({
      message: "Xác minh email thành công.",
      accessToken,
    });
  } catch (error) {
    console.error("Lỗi khi xác minh email", error);
    return res.status(500).json({ message: error.message || "Lỗi hệ thống" });
  }
};

export const requestPasswordReset = async (req, res) => {
  try {
    if (!isMailConfigured()) {
      return res.status(503).json({
        message: "Email server chưa được cấu hình. Vui lòng bổ sung SMTP trong backend/.env.",
      });
    }

    const email = normalizeCredential(req.body?.email);

    if (!email) {
      return res.status(400).json({ message: "Thiếu email để khôi phục mật khẩu." });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "Email này không tồn tại trong hệ thống.",
      });
    }

    if (!user.emailVerified) {
      return res.status(400).json({
        message: "Tài khoản này chưa xác minh email nên chưa thể đổi mật khẩu.",
      });
    }

    const result = await sendPasswordResetCode(user);

    return res.status(200).json({
      message: "Mã OTP khôi phục đã được gửi tới email của bạn.",
      resendAfter: result.resendAfter,
      expiresIn: result.expiresIn,
    });
  } catch (error) {
    console.error("Lỗi khi gửi email quên mật khẩu", error);
    return res.status(500).json({
      message: error.message || "Không thể gửi hướng dẫn khôi phục mật khẩu.",
    });
  }
};

export const verifyPasswordResetCode = async (req, res) => {
  try {
    const email = normalizeCredential(req.body?.email);
    const code = normalizeText(req.body?.code);

    if (!email || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: "Thiếu email hoặc mã OTP 6 số." });
    }

    const user = await User.findOne({ email });

    if (!user || !user.emailVerified) {
      return res.status(400).json({
        message: "Không tìm thấy yêu cầu khôi phục còn hiệu lực.",
      });
    }

    const emailVerification = await EmailVerification.findOne({
      email,
      purpose: "password_reset",
    });

    if (!emailVerification) {
      return res.status(400).json({
        message: "Không tìm thấy mã OTP còn hiệu lực. Vui lòng gửi lại mã.",
      });
    }

    if (emailVerification.expiresAt < new Date()) {
      await emailVerification.deleteOne();
      return res.status(400).json({ message: "Mã OTP đã hết hạn." });
    }

    const isCodeCorrect = emailVerification.codeHash === hashVerificationCode(code);

    if (!isCodeCorrect) {
      emailVerification.attempts += 1;

      if (emailVerification.attempts >= PASSWORD_RESET_CODE_MAX_ATTEMPTS) {
        await emailVerification.deleteOne();
        return res.status(429).json({
          message: "Bạn nhập sai mã quá nhiều lần. Vui lòng yêu cầu mã mới.",
        });
      }

      await emailVerification.save();
      return res.status(400).json({ message: "Mã OTP không chính xác." });
    }

    await emailVerification.deleteOne();

    const resetToken = createPasswordResetToken(user);

    return res.status(200).json({
      message: "Xác thực OTP thành công.",
      resetToken,
    });
  } catch (error) {
    console.error("Lỗi khi xác thực OTP quên mật khẩu", error);
    return res.status(500).json({
      message: error.message || "Không thể xác thực OTP khôi phục mật khẩu.",
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const token = normalizeText(req.body?.token);
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!token || !password) {
      return res.status(400).json({ message: "Thiếu token hoặc mật khẩu mới." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Mật khẩu mới phải có ít nhất 6 ký tự." });
    }

    let payload;

    try {
      payload = verifyPasswordResetToken(token);
    } catch (error) {
      return res.status(400).json({
        message: "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.",
      });
    }

    if (!payload || typeof payload === "string" || payload.purpose !== "password-reset") {
      return res.status(400).json({ message: "Token đặt lại mật khẩu không hợp lệ." });
    }

    const user = await User.findById(payload.userId);

    if (!user || !user.emailVerified) {
      return res.status(400).json({
        message: "Không tìm thấy tài khoản hợp lệ để đặt lại mật khẩu.",
      });
    }

    if (payload.fingerprint !== createPasswordResetFingerprint(user)) {
      return res.status(400).json({
        message: "Liên kết đặt lại mật khẩu đã được dùng hoặc không còn hiệu lực.",
      });
    }

    user.hashedPassword = await bcrypt.hash(password, 10);
    mergeAuthProvider(user, "local");
    await user.save();

    await EmailVerification.deleteMany({
      email: user.email,
      purpose: "password_reset",
    });
    await Session.deleteMany({ userId: user._id });
    res.clearCookie("refreshToken", getAuthCookieOptions(req));

    return res.status(200).json({
      message: "Mật khẩu đã được cập nhật. Bạn có thể đăng nhập lại ngay bây giờ.",
    });
  } catch (error) {
    console.error("Lỗi khi đặt lại mật khẩu", error);
    return res.status(500).json({
      message: error.message || "Không thể đặt lại mật khẩu.",
    });
  }
};

export const signIn = async (req, res) => {
  try {
    // lấy inputs
    const credential = normalizeCredential(req.body?.credential ?? req.body?.username);
    const { password } = req.body;

    if (!credential || !password) {
      return res
        .status(400)
        .json({ message: "Thiếu email hoặc tên đăng nhập, hoặc password." });
    }

    // lấy hashedPassword trong db để so với password input
    const user = await User.findOne({
      $or: [{ username: credential }, { email: credential }],
    });

    if (!user) {
      return res
        .status(401)
        .json({ message: "email, username hoặc password không chính xác" });
    }

    if (!user.emailVerified) {
      const verificationResult = await sendAccountVerificationCode(user).catch((error) => ({
        error: error.message || "Không gửi được mã xác minh.",
      }));

      return res.status(403).json({
        message: "Tài khoản chưa được xác minh email.",
        requiresVerification: true,
        email: user.email,
        resendAfter:
          verificationResult && "resendAfter" in verificationResult
            ? verificationResult.resendAfter
            : undefined,
        sendCodeError:
          verificationResult && "error" in verificationResult
            ? verificationResult.error
            : undefined,
      });
    }

    if (!user.hashedPassword || !isLocalAccount(user)) {
      return res.status(400).json({
        message: "Tài khoản này đang đăng nhập bằng Google. Vui lòng dùng Google để tiếp tục.",
      });
    }

    // kiểm tra password
    const passwordCorrect = await bcrypt.compare(password, user.hashedPassword);

    if (!passwordCorrect) {
      return res
        .status(401)
        .json({ message: "email, username hoặc password không chính xác" });
    }

    return finalizeLogin({ req, res, user, provider: "local" });
  } catch (error) {
    console.error("Lỗi khi gọi signIn", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const signInWithGoogle = async (req, res) => {
  try {
    const accessToken = normalizeText(req.body?.accessToken);
    const referralCode = normalizeReferralCode(req.body?.referralCode);

    if (!accessToken) {
      return res.status(400).json({ message: "Thiếu access token từ Google." });
    }

    const googleProfile = await fetchGoogleProfile(accessToken);
    const { user, isNewUser } = await findOrCreateGoogleUser(googleProfile, {
      referralCode,
    });

    if (!user.emailVerified) {
      await sendAccountVerificationCode(user);
      return res.status(403).json({
        message: "Tài khoản Google mới cần xác minh email trước khi vào app.",
        requiresVerification: true,
        email: user.email,
      });
    }

    return finalizeLogin({
      req,
      res,
      user,
      provider: "google",
      isNewUser,
    });
  } catch (error) {
    console.error("Lỗi khi gọi signInWithGoogle", error);
    if (error?.code === "INVALID_REFERRAL_CODE") {
      return res.status(400).json({
        message: "Mã giới thiệu không hợp lệ.",
      });
    }
    return res.status(401).json({
      message: error.message || "Không thể đăng nhập bằng Google.",
    });
  }
};

export const signOut = async (req, res) => {
  try {
    // lấy refresh token từ cookie
    const token = req.cookies?.refreshToken;

    if (token) {
      // xoá refresh token trong Session
      await Session.deleteOne({ refreshToken: token });

      // xoá cookie
      res.clearCookie("refreshToken", getAuthCookieOptions(req));
    }

    return res.sendStatus(204);
  } catch (error) {
    console.error("Lỗi khi gọi signOut", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// tạo access token mới từ refresh token
export const refreshToken = async (req, res) => {
  try {
    // lấy refresh token từ cookie
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ message: "Token không tồn tại." });
    }

    // so với refresh token trong db
    const session = await Session.findOne({ refreshToken: token });

    if (!session) {
      return res.status(403).json({ message: "Token không hợp lệ hoặc đã hết hạn" });
    }

    // kiểm tra hết hạn chưa
    if (session.expiresAt < new Date()) {
      return res.status(403).json({ message: "Token đã hết hạn." });
    }

    const user = await User.findById(session.userId).select("role moderationStatus moderationNote lockedAt");

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy tài khoản cho phiên đăng nhập này." });
    }

    const blockedMessage = ensureUserCanAccessApp(user);
    if (blockedMessage) {
      const accessToken = createAccessToken(session.userId);
      return res.status(200).json({
        ...buildLockedAccountPayload(user),
        accessToken,
      });
    }

    // tạo access token mới
    const accessToken = createAccessToken(session.userId);

    // return
    return res.status(200).json({ accessToken });
  } catch (error) {
    console.error("Lỗi khi gọi refreshToken", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
