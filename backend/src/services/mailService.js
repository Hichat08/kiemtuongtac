import nodemailer from "nodemailer";

const APP_NAME = "Kiếm Tương Tác";
const MAIL_TIMEZONE = "Asia/Ho_Chi_Minh";

let transporter;

const escapeHtml = (value = "") =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const isMailConfigured = () =>
  Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
  );

const getTransporter = () => {
  if (!isMailConfigured()) {
    throw new Error("SMTP chưa được cấu hình trong file .env");
  }

  if (!transporter) {
    const port = Number(process.env.SMTP_PORT);

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  return transporter;
};

const resolveFrom = () =>
  process.env.MAIL_FROM || `${APP_NAME} <${process.env.SMTP_USER}>`;

const formatCurrency = (value = 0) =>
  new Intl.NumberFormat("vi-VN").format(Number(value ?? 0));

const formatDateTime = (value) => {
  if (!value) {
    return "Ngay khi he thong ghi nhan";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: MAIL_TIMEZONE,
  }).format(new Date(value));
};

const maskAccountNumber = (value = "") => {
  const digits = `${value ?? ""}`.replace(/\s+/g, "");

  if (!digits) {
    return "Khong co";
  }

  if (digits.length <= 4) {
    return digits;
  }

  return `****${digits.slice(-4)}`;
};

const buildInfoRows = (rows) =>
  rows
    .filter((row) => row && row.label && row.value)
    .map(
      (row) => `
        <div style="display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid rgba(123,25,216,0.08);">
          <span style="font-weight:700;color:#2f2441;">${escapeHtml(row.label)}</span>
          <span style="text-align:right;color:#615a72;">${escapeHtml(row.value)}</span>
        </div>
      `
    )
    .join("");

export const sendEmail = async ({ to, subject, html, text }) => {
  const mailer = getTransporter();

  return mailer.sendMail({
    from: resolveFrom(),
    to,
    subject,
    html,
    text,
  });
};

const wrapEmail = ({ eyebrow, title, body, footer = "" }) => `
  <div style="margin:0;background:#f7f4ff;padding:32px 16px;font-family:Inter,Arial,sans-serif;color:#2f2441;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:28px;padding:32px;border:1px solid rgba(123,25,216,0.08);box-shadow:0 24px 56px -36px rgba(123,25,216,0.28);">
      <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:rgba(123,25,216,0.08);color:#7b19d8;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">
        ${escapeHtml(eyebrow)}
      </div>
      <h1 style="margin:18px 0 12px;font-size:30px;line-height:1.1;font-weight:800;letter-spacing:-0.04em;color:#2f2441;">
        ${escapeHtml(title)}
      </h1>
      <div style="font-size:16px;line-height:1.75;color:#615a72;">
        ${body}
      </div>
      ${
        footer
          ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#9a91aa;">${footer}</p>`
          : ""
      }
    </div>
  </div>
`;

const wrapInfoCard = (rows) => `
  <div style="margin:0 0 18px;padding:18px 20px;border-radius:22px;background:#f7f4ff;border:1px solid rgba(123,25,216,0.08);">
    ${buildInfoRows(rows)}
  </div>
`;

export const buildSignUpVerificationEmail = ({ code, expiresInMinutes = 10 }) => ({
  subject: `${APP_NAME} | Mã xác minh đăng ký`,
  text: `Mã xác minh đăng ký của bạn là ${code}. Mã có hiệu lực trong ${expiresInMinutes} phút.`,
  html: wrapEmail({
    eyebrow: "Xac minh email",
    title: "Mã xác minh của bạn",
    body: `
      <p style="margin:0 0 18px;">Dùng mã dưới đây để hoàn tất đăng ký tài khoản mới trên ${APP_NAME}.</p>
      <div style="margin:0 0 18px;padding:18px 20px;border-radius:22px;background:linear-gradient(135deg,#7b19d8,#b743ff);color:#ffffff;font-size:34px;font-weight:800;letter-spacing:0.28em;text-align:center;">
        ${escapeHtml(code)}
      </div>
      <p style="margin:0;">Mã có hiệu lực trong <strong>${expiresInMinutes} phút</strong>. Nếu bạn không yêu cầu mã này, hãy bỏ qua email.</p>
    `,
    footer: "Vì lý do bảo mật, không chia sẻ mã này cho người khác.",
  }),
});

export const buildWelcomeEmail = ({ displayName }) => ({
  subject: `${APP_NAME} | Chào mừng bạn`,
  text: `Xin chào ${displayName}, tài khoản của bạn trên ${APP_NAME} đã được kích hoạt thành công.`,
  html: wrapEmail({
    eyebrow: "Chao mung",
    title: `Xin chào ${displayName}`,
    body: `
      <p style="margin:0 0 16px;">Tài khoản của bạn trên ${APP_NAME} đã được kích hoạt thành công.</p>
      <p style="margin:0;">Bạn có thể bắt đầu đăng nhập, quản lý kết nối và sử dụng toàn bộ tính năng ngay bây giờ.</p>
    `,
  }),
});

export const buildLoginAlertEmail = ({
  displayName,
  provider,
  ipAddress,
  userAgent,
  signedInAt,
}) => ({
  subject: `${APP_NAME} | Phát hiện đăng nhập mới`,
  text: [
    `Xin chào ${displayName},`,
    `Hệ thống vừa ghi nhận một lần đăng nhập qua ${provider}.`,
    `Thời gian: ${signedInAt}`,
    `IP: ${ipAddress}`,
    `Thiết bị: ${userAgent}`,
    "Nếu đây không phải bạn, hãy đổi mật khẩu ngay.",
  ].join("\n"),
  html: wrapEmail({
    eyebrow: "Canh bao dang nhap",
    title: "Phát hiện đăng nhập mới",
    body: `
      <p style="margin:0 0 16px;">Xin chào <strong>${escapeHtml(displayName)}</strong>, hệ thống vừa ghi nhận một lần đăng nhập qua <strong>${escapeHtml(provider)}</strong>.</p>
      <div style="margin:0 0 18px;padding:18px 20px;border-radius:22px;background:#f7f4ff;border:1px solid rgba(123,25,216,0.08);">
        <p style="margin:0 0 8px;"><strong>Thời gian:</strong> ${escapeHtml(signedInAt)}</p>
        <p style="margin:0 0 8px;"><strong>Địa chỉ IP:</strong> ${escapeHtml(ipAddress)}</p>
        <p style="margin:0;"><strong>Thiết bị:</strong> ${escapeHtml(userAgent)}</p>
      </div>
      <p style="margin:0;">Nếu đây không phải bạn, hãy đổi mật khẩu ngay và kiểm tra lại các phiên đăng nhập của tài khoản.</p>
    `,
  }),
});

export const buildPasswordResetOtpEmail = ({
  displayName,
  code,
  expiresInMinutes = 10,
}) => ({
  subject: `${APP_NAME} | Mã OTP đặt lại mật khẩu`,
  text: [
    `Xin chào ${displayName},`,
    `Mã OTP đặt lại mật khẩu của bạn là ${code}.`,
    `Mã có hiệu lực trong ${expiresInMinutes} phút.`,
    "Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.",
  ].join("\n"),
  html: wrapEmail({
    eyebrow: "Khoi phuc mat khau",
    title: "Mã OTP của bạn",
    body: `
      <p style="margin:0 0 16px;">Xin chào <strong>${escapeHtml(displayName)}</strong>, hãy dùng mã OTP dưới đây để tiếp tục khôi phục mật khẩu cho tài khoản ${APP_NAME}.</p>
      <div style="margin:0 0 18px;padding:18px 20px;border-radius:22px;background:linear-gradient(135deg,#7b19d8,#ff66c7);color:#ffffff;font-size:34px;font-weight:800;letter-spacing:0.28em;text-align:center;">
        ${escapeHtml(code)}
      </div>
      <p style="margin:0;">Mã có hiệu lực trong <strong>${expiresInMinutes} phút</strong>. Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.</p>
    `,
    footer: "Vì lý do bảo mật, không chia sẻ mã OTP này cho người khác.",
  }),
});

export const buildWithdrawalOtpEmail = ({
  displayName,
  code,
  expiresInMinutes = 10,
}) => ({
  subject: `${APP_NAME} | Mã xác minh giao dịch`,
  text: [
    `Xin chào ${displayName},`,
    `Mã xác minh giao dịch của bạn là ${code}.`,
    `Mã có hiệu lực trong ${expiresInMinutes} phút.`,
    "Nếu bạn không thực hiện giao dịch này, hãy đổi mật khẩu và kiểm tra lại tài khoản.",
  ].join("\n"),
  html: wrapEmail({
    eyebrow: "Xac minh giao dich",
    title: "Mã xác minh giao dịch",
    body: `
      <p style="margin:0 0 16px;">Xin chào <strong>${escapeHtml(displayName)}</strong>, hãy nhập mã dưới đây để xác nhận giao dịch trên ${APP_NAME}.</p>
      <div style="margin:0 0 18px;padding:18px 20px;border-radius:22px;background:linear-gradient(135deg,#7b19d8,#ff66c7);color:#ffffff;font-size:34px;font-weight:800;letter-spacing:0.28em;text-align:center;">
        ${escapeHtml(code)}
      </div>
      <p style="margin:0;">Mã có hiệu lực trong <strong>${expiresInMinutes} phút</strong>. Nếu bạn không thực hiện yêu cầu này, hãy đổi mật khẩu và kiểm tra lại email bảo mật.</p>
    `,
    footer: "Vì lý do bảo mật, không chia sẻ mã xác minh giao dịch này cho người khác.",
  }),
});

export const buildFinancialRequestStatusEmail = ({
  displayName,
  requestType,
  status,
  requestCode,
  amount,
  bonusAmount = 0,
  totalAmount = 0,
  receivableAmount = 0,
  methodTitle = "",
  bankName = "",
  accountNumber = "",
  processedNote = "",
  requestedAt,
  processedAt,
}) => {
  const isDeposit = requestType === "deposit";
  const isApproved = status === "approved";
  const title = isDeposit
    ? isApproved
      ? "Yêu cầu nạp tiền đã được duyệt"
      : "Yêu cầu nạp tiền chưa được chấp nhận"
    : isApproved
      ? "Yêu cầu rút tiền đã được duyệt"
      : "Yêu cầu rút tiền chưa được chấp nhận";
  const eyebrow = isDeposit ? "Cap nhat nap tien" : "Cap nhat rut tien";
  const amountLabel = isDeposit ? "Tong gia tri vao vi" : "So tien yeu cau";
  const amountValue = isDeposit
    ? `${formatCurrency(totalAmount || amount)} VND`
    : `${formatCurrency(amount)} VND`;
  const extraAmountRow =
    isDeposit && Number(bonusAmount) > 0
      ? {
          label: "Thuong nap",
          value: `${formatCurrency(bonusAmount)} VND`,
        }
      : !isDeposit && Number(receivableAmount) > 0
        ? {
            label: "Thuc nhan",
            value: `${formatCurrency(receivableAmount)} VND`,
          }
        : null;
  const channelRow = isDeposit
    ? {
        label: "Kenh nap",
        value: methodTitle || bankName || "Nap tien",
      }
    : {
        label: "Tai khoan nhan",
        value: `${bankName || "Ngan hang"} • ${maskAccountNumber(accountNumber)}`,
      };
  const safeProcessedNote = `${processedNote ?? ""}`.trim();
  const processedNoteLabel = isApproved ? "Ghi chu he thong" : "Ly do xu ly";
  const statusSentence = isDeposit
    ? isApproved
      ? `He thong da cong vao vi cua ban ${formatCurrency(totalAmount || amount)} VND.`
      : "Yeu cau nap cua ban hien chua duoc chap nhan."
    : isApproved
      ? `Yeu cau rut ${formatCurrency(amount)} VND cua ban da duoc xac nhan thanh toan.`
      : "Yeu cau rut tien cua ban hien chua duoc chap nhan.";

  return {
    subject: `${APP_NAME} | ${title}`,
    text: [
      `Xin chào ${displayName},`,
      statusSentence,
      `Mã yêu cầu: ${requestCode}`,
      `${amountLabel}: ${amountValue}`,
      extraAmountRow ? `${extraAmountRow.label}: ${extraAmountRow.value}` : "",
      `${channelRow.label}: ${channelRow.value}`,
      `Thời gian gửi: ${formatDateTime(requestedAt)}`,
      `Thời gian xử lý: ${formatDateTime(processedAt)}`,
      safeProcessedNote ? `${processedNoteLabel}: ${safeProcessedNote}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    html: wrapEmail({
      eyebrow,
      title,
      body: `
        <p style="margin:0 0 16px;">Xin chao <strong>${escapeHtml(displayName)}</strong>, ${escapeHtml(
          statusSentence
        )}</p>
        ${wrapInfoCard([
          {
            label: "Ma yeu cau",
            value: requestCode,
          },
          {
            label: amountLabel,
            value: amountValue,
          },
          extraAmountRow,
          channelRow,
          {
            label: "Thoi gian gui",
            value: formatDateTime(requestedAt),
          },
          {
            label: "Thoi gian xu ly",
            value: formatDateTime(processedAt),
          },
          safeProcessedNote
            ? {
                label: processedNoteLabel,
                value: safeProcessedNote,
              }
            : null,
        ])}
        ${
          safeProcessedNote
            ? `<p style="margin:0;">Noi dung xu ly chi tiet da duoc dinh kem ro rang trong bang thong tin ben tren.</p>`
            : `<p style="margin:0;">Ban co the mo muc thong bao trong tai khoan de xem lai lich su giao dich bat cu luc nao.</p>`
        }
      `,
      footer:
        "Cac cap nhat giao dich quan trong duoc gui cong khai qua ung dung va email de dam bao minh bach cho tai khoan cua ban.",
    }),
  };
};

export const buildWalletAdjustmentEmail = ({
  displayName,
  accountId = "",
  direction,
  amount,
  reasonLabel = "",
  note = "",
  effectiveAt,
}) => {
  const isCredit = direction === "credit";
  const title = isCredit ? "Vi cua ban vua duoc cong tien" : "Vi cua ban vua bi tru tien";
  const safeNote = `${note ?? ""}`.trim();
  const safeReasonLabel = `${reasonLabel ?? ""}`.trim() || "Cap nhat so du vi";
  const detailLabel = safeNote ? "Chi tiet cap nhat" : "";
  const statusSentence = isCredit
    ? `He thong vua cong ${formatCurrency(amount)} VND vao vi cua ban.`
    : `He thong vua tru ${formatCurrency(amount)} VND khoi vi cua ban.`;

  return {
    subject: `${APP_NAME} | ${title}`,
    text: [
      `Xin chào ${displayName},`,
      statusSentence,
      `Tai khoan: ${accountId || "Dang cap nhat"}`,
      `Ly do: ${safeReasonLabel}`,
      `So tien: ${formatCurrency(amount)} VND`,
      `Thoi gian: ${formatDateTime(effectiveAt)}`,
      safeNote ? `${detailLabel}: ${safeNote}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    html: wrapEmail({
      eyebrow: isCredit ? "Cong tien vao vi" : "Tru tien khoi vi",
      title,
      body: `
        <p style="margin:0 0 16px;">Xin chao <strong>${escapeHtml(
          displayName
        )}</strong>, ${escapeHtml(statusSentence)}</p>
        ${wrapInfoCard([
          {
            label: "Tai khoan",
            value: accountId || "Dang cap nhat",
          },
          {
            label: "Ly do",
            value: safeReasonLabel,
          },
          {
            label: "So tien",
            value: `${formatCurrency(amount)} VND`,
          },
          {
            label: "Thoi gian",
            value: formatDateTime(effectiveAt),
          },
          safeNote
            ? {
                label: detailLabel,
                value: safeNote,
              }
            : null,
        ])}
        ${
          safeNote
            ? `<p style="margin:0;">Phan chi tiet cap nhat da duoc bo sung ngay trong bang thong tin ben tren.</p>`
            : `<p style="margin:0;">Ban co the kiem tra ngay trong lich su thong bao va so du vi de doi chieu minh bach.</p>`
        }
      `,
      footer:
        "Mọi biến động cộng hoặc trừ tiền quan trọng đều được gửi công khai qua email và trung tâm thông báo để tăng độ tin cậy cho tài khoản.",
    }),
  };
};

export const buildModerationStatusEmail = ({
  displayName,
  action,
  note = "",
  warningCount = 0,
  effectiveAt,
}) => {
  const safeNote = `${note ?? ""}`.trim() || "Vui lòng kiểm tra lại trung tâm thông báo trong ứng dụng.";
  const actionMeta = {
    warn: {
      eyebrow: "Canh cao tai khoan",
      title: "Tai khoan cua ban vua nhan canh cao",
      summary: "He thong vua ghi nhan mot canh cao moi cho tai khoan cua ban.",
      extraLabel: "So lan canh cao",
      extraValue: `${Math.max(Number(warningCount ?? 1), 1)}`,
    },
    lock: {
      eyebrow: "Khoa tai khoan",
      title: "Tai khoan cua ban da bi tam khoa",
      summary: "Tai khoan cua ban hien da bi tam khoa de phuc vu qua trinh ra soat.",
      extraLabel: "Trang thai",
      extraValue: "Tam khoa",
    },
    unlock: {
      eyebrow: "Mo khoa tai khoan",
      title: "Tai khoan cua ban da duoc mo khoa",
      summary: "Tai khoan cua ban da duoc mo khoa va co the quay lai su dung binh thuong.",
      extraLabel: "Trang thai",
      extraValue: "Da mo khoa",
    },
    clear: {
      eyebrow: "Go canh cao",
      title: "Canh cao tren tai khoan da duoc go bo",
      summary: "Trang thai canh cao hien tai da duoc go bo boi quan tri he thong.",
      extraLabel: "Trang thai",
      extraValue: "Khong con canh cao",
    },
  }[action] ?? {
    eyebrow: "Cap nhat moderation",
    title: "Tai khoan cua ban co cap nhat moderation moi",
    summary: "Trang thai moderation tren tai khoan cua ban vua duoc cap nhat.",
    extraLabel: "Trang thai",
    extraValue: "Da cap nhat",
  };

  return {
    subject: `${APP_NAME} | ${actionMeta.title}`,
    text: [
      `Xin chào ${displayName},`,
      actionMeta.summary,
      `Thời gian: ${formatDateTime(effectiveAt)}`,
      `${actionMeta.extraLabel}: ${actionMeta.extraValue}`,
      `Lý do: ${safeNote}`,
    ].join("\n"),
    html: wrapEmail({
      eyebrow: actionMeta.eyebrow,
      title: actionMeta.title,
      body: `
        <p style="margin:0 0 16px;">Xin chao <strong>${escapeHtml(displayName)}</strong>, ${escapeHtml(
          actionMeta.summary
        )}</p>
        ${wrapInfoCard([
          {
            label: "Thoi gian",
            value: formatDateTime(effectiveAt),
          },
          {
            label: actionMeta.extraLabel,
            value: actionMeta.extraValue,
          },
          {
            label: "Ly do",
            value: safeNote,
          },
        ])}
        <p style="margin:0;">Ban co the mo trung tam thong bao trong ung dung de xem lai lich su cap nhat moderation bat cu luc nao.</p>
      `,
      footer:
        "Nhung cap nhat moderation quan trong luon duoc gui qua email va thong bao trong ung dung de nguoi dung co du thong tin doi chieu.",
    }),
  };
};

export const buildAdminBroadcastEmail = ({
  displayName,
  title,
  content,
  type,
  sentAt,
}) => {
  const typeLabelMap = {
    system: "Thong bao he thong",
    promotion: "Thong bao uu dai",
    warning: "Thong bao can luu y",
    task: "Thong bao nhiem vu",
  };
  const typeLabel = typeLabelMap[type] ?? "Thong bao tu quan tri";

  return {
    subject: `${APP_NAME} | ${title}`,
    text: [
      `Xin chào ${displayName},`,
      `${typeLabel}: ${title}`,
      content,
      `Thời gian gửi: ${formatDateTime(sentAt)}`,
    ].join("\n"),
    html: wrapEmail({
      eyebrow: typeLabel,
      title,
      body: `
        <p style="margin:0 0 16px;">Xin chao <strong>${escapeHtml(
          displayName
        )}</strong>, ban vua nhan mot thong bao cong khai tu ban quan tri.</p>
        ${wrapInfoCard([
          {
            label: "Loai thong bao",
            value: typeLabel,
          },
          {
            label: "Thoi gian gui",
            value: formatDateTime(sentAt),
          },
        ])}
        <p style="margin:0;white-space:pre-line;">${escapeHtml(content)}</p>
      `,
      footer:
        "Thong bao quan tri duoc hien thi dong thoi trong chuong thong bao va email de nguoi dung co the doi chieu ro rang.",
    }),
  };
};
