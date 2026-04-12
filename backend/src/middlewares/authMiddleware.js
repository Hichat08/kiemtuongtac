// @ts-nocheck
import jwt from "jsonwebtoken";
import Session from "../models/Session.js";
import User from "../models/User.js";

const isMongoError = (error) => {
  const errorName = `${error?.name ?? ""}`;
  const errorMessage = `${error?.message ?? ""}`;

  return errorName.startsWith("Mongo") || /mongodb/i.test(errorMessage);
};

const isSupportChatRequest = (req) => {
  const path = req.path || "";
  const method = `${req.method || ""}`.toUpperCase();

  if (method === "POST" && path === "/api/conversations/support-room") {
    return true;
  }

  if (method === "GET" && path === "/api/conversations") {
    return true;
  }

  if (method === "GET" && /^\/api\/conversations\/[^/]+\/messages$/.test(path)) {
    return true;
  }

  if (method === "PATCH" && /^\/api\/conversations\/[^/]+\/seen$/.test(path)) {
    return true;
  }

  if (method === "POST" && path === "/api/messages/group") {
    return true;
  }

  if (method === "GET" && path === "/api/users/me") {
    return true;
  }

  if (method === "GET" && path === "/api/users/lock-status") {
    return true;
  }

  return false;
};

// authorization - xác minh user là ai
export const protectedRoute = async (req, res, next) => {
  try {
    // lấy token từ header
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer <token>

    if (!token) {
      if (isSupportChatRequest(req)) {
        const refreshToken = req.cookies?.refreshToken;
        if (refreshToken) {
          const session = await Session.findOne({ refreshToken });
          if (session && session.expiresAt >= new Date()) {
            const user = await User.findById(session.userId).select("-hashedPassword");
            if (user) {
              req.user = user;
              return next();
            }
          }
        }
      }

      return res.status(401).json({ message: "Không tìm thấy access token" });
    }

    let decodedUser;
    try {
      decodedUser = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch {
      if (isSupportChatRequest(req)) {
        const refreshToken = req.cookies?.refreshToken;
        if (refreshToken) {
          const session = await Session.findOne({ refreshToken });
          if (session && session.expiresAt >= new Date()) {
            const user = await User.findById(session.userId).select("-hashedPassword");
            if (user) {
              req.user = user;
              return next();
            }
          }
        }
      }

      return res
        .status(403)
        .json({ message: "Access token hết hạn hoặc không đúng" });
    }

    let user;
    try {
      // tìm user
      user = await User.findById(decodedUser.userId).select("-hashedPassword");
    } catch (error) {
      console.error("Lỗi khi truy vấn người dùng trong authMiddleware", error);

      return res.status(isMongoError(error) ? 503 : 500).json({
        message: isMongoError(error)
          ? "CSDL tạm thời không khả dụng"
          : "Lỗi hệ thống",
      });
    }

    if (!user) {
      return res.status(404).json({ message: "người dùng không tồn tại." });
    }

    let needsSave = false;

    if (!user.accountId) {
      await user.ensureAccountId();
      needsSave = true;
    }

    if (!user.role) {
      user.role = "user";
      needsSave = true;
    }

    if (needsSave) {
      await user.save();
    }

    if (user.role !== "admin" && user.moderationStatus === "locked") {
      if (isSupportChatRequest(req)) {
        req.user = user;
        return next();
      }

      const note = `${user.moderationNote ?? ""}`.trim();

      return res.status(423).json({
        message: note
          ? `Tài khoản của bạn hiện đang bị khóa. ${note}`
          : "Tài khoản của bạn hiện đang bị khóa. Vui lòng liên hệ admin để được hỗ trợ.",
        accountLocked: true,
        lockReason: note,
        lockedAt: user.lockedAt ? new Date(user.lockedAt).toISOString() : null,
      });
    }

    // trả user về trong req
    req.user = user;
    next();
  } catch (error) {
    console.error("Lỗi hệ thống trong authMiddleware", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
