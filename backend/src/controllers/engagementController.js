import AdminBroadcastNotification from "../models/AdminBroadcastNotification.js";
import PromotionCampaign from "../models/PromotionCampaign.js";
import SocialTask from "../models/SocialTask.js";
import TaskSubmission from "../models/TaskSubmission.js";
import User from "../models/User.js";
import WalletAdjustment from "../models/WalletAdjustment.js";
import { uploadImageFromBuffer } from "../middlewares/uploadMiddleware.js";
import {
  queueAdminBroadcastEmails,
  queueWalletAdjustmentEmail,
} from "../services/userNotificationService.js";

const CAMPAIGN_CATEGORIES = ["event", "promotion"];
const CAMPAIGN_STATUSES = ["draft", "scheduled", "running", "paused", "completed"];
const BROADCAST_TYPES = ["system", "promotion", "warning", "task"];
const BROADCAST_AUDIENCES = ["all", "verified", "new_7d"];
const BROADCAST_STATUSES = ["sent", "scheduled"];
const TASK_PLATFORMS = ["facebook", "tiktok", "youtube", "other"];
const TASK_STATUSES = ["running", "pending", "completed", "paused"];
const TASK_SUBMISSION_STATUSES = ["pending", "approved", "rejected"];
const dayMs = 24 * 60 * 60 * 1000;

const normalizeText = (value, maxLength = 500) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const normalizeUpperText = (value, maxLength = 60) => normalizeText(value, maxLength).toUpperCase();

const parseRequiredText = (value, label, maxLength) => {
  const normalizedValue = normalizeText(value, maxLength);

  if (!normalizedValue) {
    throw new Error(`Vui lòng nhập ${label}.`);
  }

  return normalizedValue;
};

const parseEnumValue = (value, allowedValues, label) => {
  const normalizedValue = normalizeText(value, 40).toLowerCase();

  if (!allowedValues.includes(normalizedValue)) {
    throw new Error(`${label} không hợp lệ.`);
  }

  return normalizedValue;
};

const parseDateValue = (value, label) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`${label} không hợp lệ.`);
  }

  return parsedDate;
};

const parseNumberValue = (value, label, { integer = false, min = 0, allowZero = true } = {}) => {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${label} không được để trống.`);
  }

  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    throw new Error(`${label} phải là số hợp lệ.`);
  }

  if (integer && !Number.isInteger(parsedValue)) {
    throw new Error(`${label} phải là số nguyên.`);
  }

  if (parsedValue < min || (!allowZero && parsedValue === 0)) {
    throw new Error(`${label} không hợp lệ.`);
  }

  return parsedValue;
};

const parseBooleanValue = (value) =>
  value === true || value === "true" || value === 1 || value === "1";

const buildCampaignSummary = (campaigns) => ({
  total: campaigns.length,
  running: campaigns.filter((campaign) => campaign.status === "running").length,
  scheduled: campaigns.filter((campaign) => campaign.status === "scheduled").length,
  draft: campaigns.filter((campaign) => campaign.status === "draft").length,
  paused: campaigns.filter((campaign) => campaign.status === "paused").length,
  completed: campaigns.filter((campaign) => campaign.status === "completed").length,
  events: campaigns.filter((campaign) => campaign.category === "event").length,
  promotions: campaigns.filter((campaign) => campaign.category === "promotion").length,
  highlighted: campaigns.filter((campaign) => campaign.highlighted).length,
});

const buildTaskSummary = (tasks) => ({
  total: tasks.length,
  pending: tasks.filter((task) => task.status === "pending").length,
  running: tasks.filter((task) => task.status === "running").length,
  completed: tasks.filter((task) => task.status === "completed").length,
  paused: tasks.filter((task) => task.status === "paused").length,
  hot: tasks.filter((task) => task.hot).length,
  totalTarget: tasks.reduce((total, task) => total + task.target, 0),
  totalCurrent: tasks.reduce((total, task) => total + task.current, 0),
});

const buildTaskSubmissionSummary = (submissions) => ({
  total: submissions.length,
  pending: submissions.filter((submission) => submission.status === "pending").length,
  approved: submissions.filter((submission) => submission.status === "approved").length,
  rejected: submissions.filter((submission) => submission.status === "rejected").length,
  pendingRewardTotal: submissions
    .filter((submission) => submission.status === "pending")
    .reduce((total, submission) => total + Number(submission.reward ?? 0), 0),
});

const buildBroadcastSummary = (notifications) => ({
  total: notifications.length,
  sent: notifications.filter((notification) => notification.status === "sent").length,
  scheduled: notifications.filter((notification) => notification.status === "scheduled").length,
  system: notifications.filter((notification) => notification.type === "system").length,
  promotion: notifications.filter((notification) => notification.type === "promotion").length,
  warning: notifications.filter((notification) => notification.type === "warning").length,
  task: notifications.filter((notification) => notification.type === "task").length,
});

const formatCampaign = (campaign) => ({
  id: campaign._id.toString(),
  title: campaign.title,
  category: campaign.category,
  status: campaign.status,
  audience: campaign.audience,
  benefit: campaign.benefit,
  summary: campaign.summary,
  startAt: campaign.startAt ? new Date(campaign.startAt).toISOString() : null,
  endAt: campaign.endAt ? new Date(campaign.endAt).toISOString() : null,
  highlighted: Boolean(campaign.highlighted),
  createdAt: campaign.createdAt ? new Date(campaign.createdAt).toISOString() : null,
  updatedAt: campaign.updatedAt ? new Date(campaign.updatedAt).toISOString() : null,
});

const formatTask = (task) => {
  const current = Number(task.current ?? 0);
  const target = Number(task.target ?? 0);

  return {
    id: task._id.toString(),
    code: task.code,
    title: task.title,
    brand: task.brand,
    platform: task.platform,
    reward: Number(task.reward ?? 0),
    current,
    target,
    availableSlots: Math.max(target - current, 0),
    status: task.status,
    description: task.description ?? "",
    actionLabel: task.actionLabel ?? "Nhận nhiệm vụ",
    hot: Boolean(task.hot),
    createdAt: task.createdAt ? new Date(task.createdAt).toISOString() : null,
    updatedAt: task.updatedAt ? new Date(task.updatedAt).toISOString() : null,
  };
};

const formatTaskSubmission = (submission) => ({
  id: submission._id.toString(),
  taskId:
    typeof submission.taskId === "object" && submission.taskId?._id
      ? submission.taskId._id.toString()
      : submission.taskId?.toString?.() ?? "",
  taskCode: submission.taskCode ?? "",
  taskTitle: submission.taskTitle ?? "",
  taskBrand: submission.taskBrand ?? "",
  platform: submission.platform ?? "other",
  reward: Number(submission.reward ?? 0),
  userName: submission.userDisplayName ?? "",
  userId: submission.userAccountId ?? "",
  proofLink: submission.proofLink ?? "",
  screenshotUrl: submission.screenshotUrl ?? "",
  note: submission.note ?? "",
  status: submission.status ?? "pending",
  reviewNote: submission.reviewNote ?? "",
  submittedAt: submission.submittedAt ? new Date(submission.submittedAt).toISOString() : null,
  reviewedAt: submission.reviewedAt ? new Date(submission.reviewedAt).toISOString() : null,
  approvedAt: submission.approvedAt ? new Date(submission.approvedAt).toISOString() : null,
  rejectedAt: submission.rejectedAt ? new Date(submission.rejectedAt).toISOString() : null,
});

const formatUserTask = (task, latestSubmission) => ({
  ...formatTask(task),
  submissionStatus: latestSubmission?.status ?? null,
  latestSubmissionId: latestSubmission?._id?.toString?.() ?? null,
  latestSubmissionAt: latestSubmission?.submittedAt
    ? new Date(latestSubmission.submittedAt).toISOString()
    : null,
  latestReviewNote: latestSubmission?.reviewNote ?? "",
});

const formatBroadcastNotification = (notification) => ({
  id: notification._id.toString(),
  title: notification.title,
  content: notification.content,
  type: notification.type,
  audience: notification.audience,
  status: notification.status,
  imageUrl: notification.imageUrl ?? "",
  recipientCount: Number(notification.recipientCount ?? 0),
  createdByName:
    notification.createdBy && typeof notification.createdBy === "object"
      ? notification.createdBy.displayName ?? ""
      : "",
  scheduledAt: notification.scheduledAt ? new Date(notification.scheduledAt).toISOString() : null,
  sentAt: notification.sentAt ? new Date(notification.sentAt).toISOString() : null,
  createdAt: notification.createdAt ? new Date(notification.createdAt).toISOString() : null,
  updatedAt: notification.updatedAt ? new Date(notification.updatedAt).toISOString() : null,
});

const buildCampaignPayload = (body) => {
  const startAt = parseDateValue(body?.startAt, "Thời gian bắt đầu");
  const endAt = parseDateValue(body?.endAt, "Thời gian kết thúc");

  if (startAt && endAt && startAt > endAt) {
    throw new Error("Thời gian kết thúc phải sau thời gian bắt đầu.");
  }

  return {
    title: parseRequiredText(body?.title, "tiêu đề chiến dịch", 160),
    category: parseEnumValue(body?.category, CAMPAIGN_CATEGORIES, "Loại chiến dịch"),
    status: parseEnumValue(body?.status, CAMPAIGN_STATUSES, "Trạng thái chiến dịch"),
    audience: parseRequiredText(body?.audience, "nhóm áp dụng", 180),
    benefit: parseRequiredText(body?.benefit, "quyền lợi", 220),
    summary: parseRequiredText(body?.summary, "mô tả chiến dịch", 600),
    startAt,
    endAt,
    highlighted: parseBooleanValue(body?.highlighted),
  };
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

const getBroadcastAudiencesForUser = (user, now = new Date()) => {
  if (!user || user.role === "admin") {
    return [];
  }

  const audiences = ["all"];

  if (user.emailVerified) {
    audiences.push("verified");
  }

  const createdAt = user.createdAt ? new Date(user.createdAt).getTime() : 0;

  if (createdAt && createdAt >= now.getTime() - dayMs * 7) {
    audiences.push("new_7d");
  }

  return audiences;
};

const publishDueBroadcastNotifications = async (now = new Date()) => {
  while (true) {
    const notification = await AdminBroadcastNotification.findOneAndUpdate(
      {
        status: "scheduled",
        scheduledAt: { $lte: now },
      },
      {
        $set: {
          status: "sent",
          sentAt: now,
        },
      },
      {
        new: true,
        sort: { scheduledAt: 1, createdAt: 1 },
      }
    ).lean();

    if (!notification) {
      break;
    }

    queueAdminBroadcastEmails({
      notification,
      now,
    });
  }
};

const buildBroadcastPayload = (body, now = new Date()) => {
  const status = parseEnumValue(body?.status, BROADCAST_STATUSES, "Trạng thái thông báo");
  const scheduledAt = parseDateValue(body?.scheduledAt, "Thời gian lên lịch");

  if (status === "scheduled") {
    if (!scheduledAt) {
      throw new Error("Vui lòng chọn thời gian gửi cho thông báo đã lên lịch.");
    }

    if (scheduledAt <= now) {
      throw new Error("Thời gian lên lịch phải lớn hơn thời điểm hiện tại.");
    }
  }

  return {
    title: parseRequiredText(body?.title, "tiêu đề thông báo", 160),
    content: parseRequiredText(body?.content, "nội dung thông báo", 1200),
    type: parseEnumValue(body?.type, BROADCAST_TYPES, "Loại thông báo"),
    audience: parseEnumValue(body?.audience, BROADCAST_AUDIENCES, "Đối tượng nhận"),
    status,
    imageUrl: normalizeText(body?.imageUrl, 500),
    scheduledAt: status === "scheduled" ? scheduledAt : null,
    sentAt: status === "sent" ? now : null,
  };
};

const generateTaskCode = async (platform) => {
  const prefixByPlatform = {
    facebook: "FB",
    tiktok: "TK",
    youtube: "YT",
    other: "OT",
  };

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = `${prefixByPlatform[platform] ?? "TSK"}-${Math.floor(
      100000 + Math.random() * 900000
    )}`;
    const exists = await SocialTask.exists({ code: candidate });

    if (!exists) {
      return candidate;
    }
  }

  throw new Error("Không thể tạo mã nhiệm vụ duy nhất.");
};

const buildTaskPayload = async (body, { allowAutoCode = false } = {}) => {
  const platform = parseEnumValue(body?.platform, TASK_PLATFORMS, "Nền tảng nhiệm vụ");
  const codeInput = normalizeUpperText(body?.code, 32);
  const current = parseNumberValue(body?.current, "Tiến độ hiện tại", {
    integer: true,
    min: 0,
  });
  const target = parseNumberValue(body?.target, "Mục tiêu", {
    integer: true,
    min: 1,
    allowZero: false,
  });

  if (current > target) {
    throw new Error("Tiến độ hiện tại không được lớn hơn mục tiêu.");
  }

  return {
    code: codeInput || (allowAutoCode ? await generateTaskCode(platform) : ""),
    title: parseRequiredText(body?.title, "tên nhiệm vụ", 160),
    brand: parseRequiredText(body?.brand, "thương hiệu hoặc kênh", 120),
    platform,
    reward: parseNumberValue(body?.reward, "Phần thưởng", {
      min: 0,
    }),
    current,
    target,
    status: parseEnumValue(body?.status, TASK_STATUSES, "Trạng thái nhiệm vụ"),
    description: parseRequiredText(body?.description, "mô tả nhiệm vụ", 600),
    actionLabel: normalizeText(body?.actionLabel, 60) || "Nhận nhiệm vụ",
    hot: parseBooleanValue(body?.hot),
  };
};

const buildTaskSubmissionPayload = (body) => ({
  proofLink: normalizeText(body?.proofLink, 500),
  note: normalizeText(body?.note, 500),
});

const buildTaskRewardReasonLabel = (submission) =>
  `Admin duyệt thưởng nhiệm vụ ${submission.taskCode || "TASK"}.`;

const buildTaskRewardNote = (submission) =>
  normalizeText(submission.reviewNote, 500) ||
  `Cộng thưởng cho nhiệm vụ ${submission.taskTitle || submission.taskCode || "đã hoàn thành"}.`;

const attachLatestSubmissionMap = (submissions) =>
  submissions.reduce((map, submission) => {
    const taskId = submission.taskId?.toString?.() ?? "";

    if (taskId && !map.has(taskId)) {
      map.set(taskId, submission);
    }

    return map;
  }, new Map());

const handleControllerError = (res, error, fallbackMessage) => {
  if (error?.code === 11000) {
    return res.status(409).json({ message: "Mã nhiệm vụ đã tồn tại." });
  }

  return res.status(400).json({
    message: error?.message || fallbackMessage,
  });
};

export const getAdminBroadcastNotifications = async (_req, res) => {
  try {
    await publishDueBroadcastNotifications();

    const notifications = await AdminBroadcastNotification.find({})
      .sort({ sentAt: -1, scheduledAt: 1, createdAt: -1 })
      .populate("createdBy", "displayName")
      .lean();
    const formattedNotifications = notifications.map(formatBroadcastNotification);

    return res.json({
      summary: buildBroadcastSummary(formattedNotifications),
      notifications: formattedNotifications,
    });
  } catch (error) {
    console.error("Lỗi khi tải danh sách broadcast admin", error);
    return res.status(500).json({ message: "Không tải được danh sách thông báo toàn user." });
  }
};

export const createAdminBroadcastNotification = async (req, res) => {
  try {
    const now = new Date();
    const payload = buildBroadcastPayload(req.body, now);
    const recipientCount = await User.countDocuments(getBroadcastAudienceQuery(payload.audience, now));

    const notification = await AdminBroadcastNotification.create({
      ...payload,
      recipientCount,
      createdBy: req.user?._id ?? null,
    });

    await notification.populate("createdBy", "displayName");
    if (payload.status === "sent") {
      queueAdminBroadcastEmails({
        notification: notification.toObject(),
        now,
      });
    }

    return res.status(201).json({
      message:
        payload.status === "scheduled"
          ? "Đã lên lịch gửi thông báo toàn user."
          : "Đã gửi thông báo tới nhóm người dùng đã chọn.",
      notification: formatBroadcastNotification(notification),
    });
  } catch (error) {
    console.error("Lỗi khi tạo broadcast admin", error);
    return handleControllerError(res, error, "Không thể tạo thông báo toàn user.");
  }
};

export const getAdminCampaigns = async (_req, res) => {
  try {
    const campaigns = await PromotionCampaign.find({})
      .sort({ highlighted: -1, startAt: 1, createdAt: -1 })
      .lean();
    const formattedCampaigns = campaigns.map(formatCampaign);

    return res.json({
      summary: buildCampaignSummary(formattedCampaigns),
      campaigns: formattedCampaigns,
    });
  } catch (error) {
    console.error("Lỗi khi tải danh sách chiến dịch admin", error);
    return res.status(500).json({ message: "Không tải được danh sách chiến dịch." });
  }
};

export const createAdminCampaign = async (req, res) => {
  try {
    const payload = buildCampaignPayload(req.body);
    const campaign = await PromotionCampaign.create({
      ...payload,
      createdBy: req.user?._id ?? null,
    });

    return res.status(201).json({
      message: "Đã tạo chiến dịch mới.",
      campaign: formatCampaign(campaign),
    });
  } catch (error) {
    console.error("Lỗi khi tạo chiến dịch admin", error);
    return handleControllerError(res, error, "Không tạo được chiến dịch.");
  }
};

export const updateAdminCampaign = async (req, res) => {
  try {
    const payload = buildCampaignPayload(req.body);
    const campaign = await PromotionCampaign.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });

    if (!campaign) {
      return res.status(404).json({ message: "Không tìm thấy chiến dịch." });
    }

    return res.json({
      message: "Đã cập nhật chiến dịch.",
      campaign: formatCampaign(campaign),
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật chiến dịch admin", error);
    return handleControllerError(res, error, "Không cập nhật được chiến dịch.");
  }
};

export const updateAdminCampaignStatus = async (req, res) => {
  try {
    const status = parseEnumValue(req.body?.status, CAMPAIGN_STATUSES, "Trạng thái chiến dịch");
    const campaign = await PromotionCampaign.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!campaign) {
      return res.status(404).json({ message: "Không tìm thấy chiến dịch." });
    }

    return res.json({
      message: "Đã cập nhật trạng thái chiến dịch.",
      campaign: formatCampaign(campaign),
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật trạng thái chiến dịch admin", error);
    return handleControllerError(res, error, "Không cập nhật được trạng thái chiến dịch.");
  }
};

export const deleteAdminCampaign = async (req, res) => {
  try {
    const campaign = await PromotionCampaign.findByIdAndDelete(req.params.id);

    if (!campaign) {
      return res.status(404).json({ message: "Không tìm thấy chiến dịch." });
    }

    return res.json({ message: "Đã xoá chiến dịch." });
  } catch (error) {
    console.error("Lỗi khi xoá chiến dịch admin", error);
    return res.status(500).json({ message: "Không xoá được chiến dịch." });
  }
};

export const getAdminTasks = async (_req, res) => {
  try {
    const tasks = await SocialTask.find({}).sort({ hot: -1, updatedAt: -1, createdAt: -1 }).lean();
    const formattedTasks = tasks.map(formatTask);

    return res.json({
      summary: buildTaskSummary(formattedTasks),
      tasks: formattedTasks,
    });
  } catch (error) {
    console.error("Lỗi khi tải danh sách nhiệm vụ admin", error);
    return res.status(500).json({ message: "Không tải được danh sách nhiệm vụ." });
  }
};

export const createAdminTask = async (req, res) => {
  try {
    const payload = await buildTaskPayload(req.body, { allowAutoCode: true });

    if (!payload.code) {
      throw new Error("Vui lòng nhập mã nhiệm vụ.");
    }

    const task = await SocialTask.create({
      ...payload,
      createdBy: req.user?._id ?? null,
    });

    return res.status(201).json({
      message: "Đã tạo nhiệm vụ mới.",
      task: formatTask(task),
    });
  } catch (error) {
    console.error("Lỗi khi tạo nhiệm vụ admin", error);
    return handleControllerError(res, error, "Không tạo được nhiệm vụ.");
  }
};

export const updateAdminTask = async (req, res) => {
  try {
    const payload = await buildTaskPayload(req.body);

    if (!payload.code) {
      return res.status(400).json({ message: "Vui lòng nhập mã nhiệm vụ." });
    }

    const task = await SocialTask.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });

    if (!task) {
      return res.status(404).json({ message: "Không tìm thấy nhiệm vụ." });
    }

    return res.json({
      message: "Đã cập nhật nhiệm vụ.",
      task: formatTask(task),
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật nhiệm vụ admin", error);
    return handleControllerError(res, error, "Không cập nhật được nhiệm vụ.");
  }
};

export const updateAdminTaskStatus = async (req, res) => {
  try {
    const status = parseEnumValue(req.body?.status, TASK_STATUSES, "Trạng thái nhiệm vụ");
    const task = await SocialTask.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({ message: "Không tìm thấy nhiệm vụ." });
    }

    return res.json({
      message: "Đã cập nhật trạng thái nhiệm vụ.",
      task: formatTask(task),
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật trạng thái nhiệm vụ admin", error);
    return handleControllerError(res, error, "Không cập nhật được trạng thái nhiệm vụ.");
  }
};

export const deleteAdminTask = async (req, res) => {
  try {
    const task = await SocialTask.findByIdAndDelete(req.params.id);

    if (!task) {
      return res.status(404).json({ message: "Không tìm thấy nhiệm vụ." });
    }

    return res.json({ message: "Đã xoá nhiệm vụ." });
  } catch (error) {
    console.error("Lỗi khi xoá nhiệm vụ admin", error);
    return res.status(500).json({ message: "Không xoá được nhiệm vụ." });
  }
};

export const getAdminTaskSubmissions = async (_req, res) => {
  try {
    const submissions = await TaskSubmission.find({})
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean();
    const submissionPriority = {
      pending: 0,
      rejected: 1,
      approved: 2,
    };
    const formattedSubmissions = submissions
      .map(formatTaskSubmission)
      .sort((left, right) => {
        const statusDelta =
          (submissionPriority[left.status] ?? 99) - (submissionPriority[right.status] ?? 99);

        if (statusDelta !== 0) {
          return statusDelta;
        }

        return new Date(right.submittedAt ?? 0).getTime() - new Date(left.submittedAt ?? 0).getTime();
      });

    return res.json({
      summary: buildTaskSubmissionSummary(formattedSubmissions),
      submissions: formattedSubmissions,
    });
  } catch (error) {
    console.error("Lỗi khi tải danh sách bài nộp nhiệm vụ admin", error);
    return res.status(500).json({ message: "Không tải được danh sách bài nộp nhiệm vụ." });
  }
};

export const reviewAdminTaskSubmission = async (req, res) => {
  try {
    const nextStatus = parseEnumValue(
      req.body?.status,
      ["approved", "rejected"],
      "Trạng thái duyệt nhiệm vụ"
    );
    const reviewNote = normalizeText(req.body?.reviewNote, 500);
    const submission = await TaskSubmission.findById(req.params.id);

    if (!submission) {
      return res.status(404).json({ message: "Không tìm thấy bài nộp nhiệm vụ." });
    }

    if (submission.status !== "pending") {
      return res.status(400).json({ message: "Bài nộp này đã được xử lý trước đó." });
    }

    const now = new Date();

    if (nextStatus === "rejected") {
      if (!reviewNote) {
        return res.status(400).json({ message: "Vui lòng nhập lý do từ chối bài nộp." });
      }

      submission.status = "rejected";
      submission.reviewNote = reviewNote;
      submission.reviewedAt = now;
      submission.rejectedAt = now;
      submission.approvedAt = null;
      submission.reviewedBy = req.user?._id ?? null;
      await submission.save();

      return res.json({
        message: "Đã từ chối bài nộp nhiệm vụ.",
        submission: formatTaskSubmission(submission),
      });
    }

    const task = await SocialTask.findById(submission.taskId);

    if (!task) {
      return res.status(400).json({ message: "Nhiệm vụ gốc không còn tồn tại để duyệt thưởng." });
    }

    if (Number(task.current ?? 0) >= Number(task.target ?? 0)) {
      return res.status(400).json({
        message: "Nhiệm vụ này đã đạt đủ chỉ tiêu. Hãy từ chối hoặc điều chỉnh lại catalog trước.",
      });
    }

    submission.status = "approved";
    submission.reviewNote = reviewNote;
    submission.reviewedAt = now;
    submission.approvedAt = now;
    submission.rejectedAt = null;
    submission.reviewedBy = req.user?._id ?? null;
    await submission.save();

    task.current = Number(task.current ?? 0) + 1;

    if (task.current >= Number(task.target ?? 0)) {
      task.status = "completed";
    }

    await task.save();

    const adjustment = await WalletAdjustment.create({
      userId: submission.userId,
      userAccountId: submission.userAccountId ?? "",
      userDisplayName: submission.userDisplayName ?? "Người dùng",
      direction: "credit",
      reasonCode: "task_submission_reward",
      reasonLabel: buildTaskRewardReasonLabel(submission),
      amount: Number(submission.reward ?? 0),
      note: buildTaskRewardNote(submission),
      effectiveAt: now,
      createdBy: req.user?._id ?? null,
    });
    queueWalletAdjustmentEmail({ adjustment });

    return res.json({
      message: "Đã duyệt bài nộp và cộng tiền vào ví người dùng.",
      submission: formatTaskSubmission(submission),
    });
  } catch (error) {
    console.error("Lỗi khi duyệt bài nộp nhiệm vụ admin", error);
    return handleControllerError(res, error, "Không duyệt được bài nộp nhiệm vụ.");
  }
};

export const getUserBroadcastNotifications = async (req, res) => {
  try {
    await publishDueBroadcastNotifications();

    if (!req.user || req.user.role === "admin") {
      return res.json({ notifications: [] });
    }

    const now = new Date();
    const notifications = await AdminBroadcastNotification.find({
      status: "sent",
      sentAt: { $lte: now },
      audience: {
        $in: getBroadcastAudiencesForUser(req.user, now),
      },
    })
      .sort({ sentAt: -1, createdAt: -1 })
      .lean();

    const formattedNotifications = notifications.map(formatBroadcastNotification);

    return res.json({
      notifications: formattedNotifications,
    });
  } catch (error) {
    console.error("Lỗi khi tải broadcast cho user", error);
    return res.status(500).json({ message: "Không tải được thông báo hệ thống." });
  }
};

export const getUserTaskDetail = async (req, res) => {
  try {
    const task = await SocialTask.findById(req.params.id).lean();

    if (!task) {
      return res.status(404).json({ message: "Không tìm thấy nhiệm vụ." });
    }

    const [latestSubmission, relatedCount] = await Promise.all([
      TaskSubmission.findOne({
        taskId: task._id,
        userId: req.user?._id,
      })
        .sort({ submittedAt: -1, createdAt: -1 })
        .lean(),
      SocialTask.countDocuments({
        status: "running",
        $expr: { $lt: ["$current", "$target"] },
      }),
    ]);

    return res.json({
      task: formatUserTask(task, latestSubmission),
      latestSubmission: latestSubmission ? formatTaskSubmission(latestSubmission) : null,
      relatedAvailableCount: Math.max(relatedCount - 1, 0),
    });
  } catch (error) {
    console.error("Lỗi khi tải chi tiết nhiệm vụ user", error);
    return res.status(500).json({ message: "Không tải được chi tiết nhiệm vụ." });
  }
};

export const getUserTaskHistory = async (req, res) => {
  try {
    const submissions = await TaskSubmission.find({
      userId: req.user?._id,
    })
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean();

    const formattedSubmissions = submissions.map(formatTaskSubmission);

    return res.json({
      summary: {
        total: formattedSubmissions.length,
        pending: formattedSubmissions.filter((submission) => submission.status === "pending").length,
        approved: formattedSubmissions.filter((submission) => submission.status === "approved").length,
        rejected: formattedSubmissions.filter((submission) => submission.status === "rejected").length,
        totalEarned: formattedSubmissions
          .filter((submission) => submission.status === "approved")
          .reduce((total, submission) => total + Number(submission.reward ?? 0), 0),
      },
      submissions: formattedSubmissions,
    });
  } catch (error) {
    console.error("Lỗi khi tải lịch sử nhiệm vụ user", error);
    return res.status(500).json({ message: "Không tải được lịch sử nhiệm vụ." });
  }
};

export const submitUserTaskSubmission = async (req, res) => {
  try {
    const task = await SocialTask.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: "Không tìm thấy nhiệm vụ." });
    }

    if (task.status !== "running" || Number(task.current ?? 0) >= Number(task.target ?? 0)) {
      return res.status(400).json({
        message: "Nhiệm vụ này hiện không còn nhận thêm bài nộp mới.",
      });
    }

    const blockingSubmission = await TaskSubmission.findOne({
      taskId: task._id,
      userId: req.user?._id,
      status: { $in: ["pending", "approved"] },
    }).lean();

    if (blockingSubmission) {
      return res.status(400).json({
        message:
          blockingSubmission.status === "approved"
            ? "Bạn đã được duyệt thưởng cho nhiệm vụ này rồi."
            : "Bạn đã gửi bằng chứng cho nhiệm vụ này và đang chờ admin duyệt.",
      });
    }

    const payload = buildTaskSubmissionPayload(req.body);

    if (!payload.proofLink && !req.file) {
      return res.status(400).json({
        message: "Vui lòng cung cấp link bằng chứng hoặc ảnh chụp màn hình.",
      });
    }

    let uploadedScreenshot = null;

    if (req.file) {
      uploadedScreenshot = await uploadImageFromBuffer(req.file.buffer, {
        folder: "kiem_tuong_tac/task-proofs",
        transformation: [{ width: 1600, crop: "limit" }],
      });
    }

    const submission = await TaskSubmission.create({
      taskId: task._id,
      taskCode: task.code,
      taskTitle: task.title,
      taskBrand: task.brand,
      platform: task.platform,
      reward: Number(task.reward ?? 0),
      userId: req.user?._id,
      userAccountId: req.user?.accountId ?? "",
      userDisplayName: req.user?.displayName ?? "Người dùng",
      proofLink: payload.proofLink,
      screenshotUrl: uploadedScreenshot?.secure_url ?? "",
      screenshotId: uploadedScreenshot?.public_id ?? "",
      note: payload.note,
      status: "pending",
      submittedAt: new Date(),
    });

    return res.status(201).json({
      message: "Đã gửi bằng chứng hoàn thành. Chờ admin duyệt trước khi cộng tiền.",
      submission: formatTaskSubmission(submission),
      task: formatUserTask(task, submission),
    });
  } catch (error) {
    console.error("Lỗi khi gửi bài nộp nhiệm vụ user", error);
    return handleControllerError(res, error, "Không gửi được bài nộp nhiệm vụ.");
  }
};

export const getUserTasks = async (req, res) => {
  try {
    const latestSubmissions = await TaskSubmission.find({
      userId: req.user?._id,
    })
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean();
    const latestSubmissionMap = attachLatestSubmissionMap(latestSubmissions);
    const submittedTaskIds = Array.from(latestSubmissionMap.keys());
    const taskQuery = submittedTaskIds.length
      ? {
          $or: [
            {
              status: "running",
              $expr: { $lt: ["$current", "$target"] },
            },
            {
              _id: { $in: submittedTaskIds },
            },
          ],
        }
      : {
          status: "running",
          $expr: { $lt: ["$current", "$target"] },
        };
    const tasks = await SocialTask.find(taskQuery)
      .sort({ hot: -1, reward: -1, updatedAt: -1 })
      .lean();
    const formattedTasks = tasks.map((task) =>
      formatUserTask(task, latestSubmissionMap.get(task._id.toString()) ?? null)
    );

    return res.json({
      summary: {
        totalVisible: formattedTasks.length,
        hot: formattedTasks.filter((task) => task.hot).length,
        totalAvailableSlots: formattedTasks.reduce(
          (total, task) => total + task.availableSlots,
          0
        ),
      },
      tasks: formattedTasks,
    });
  } catch (error) {
    console.error("Lỗi khi tải danh sách nhiệm vụ user", error);
    return res.status(500).json({ message: "Không tải được danh sách nhiệm vụ." });
  }
};
