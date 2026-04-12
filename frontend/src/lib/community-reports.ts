import type {
  CommunityUserReportCategory,
  CommunityUserReportStatus,
} from "@/types/community-report";

export const COMMUNITY_REPORT_CATEGORY_OPTIONS: Array<{
  value: CommunityUserReportCategory;
  label: string;
  description: string;
}> = [
  {
    value: "spam",
    label: "Spam",
    description: "Quảng cáo, gửi lặp hoặc kéo traffic không phù hợp.",
  },
  {
    value: "scam",
    label: "Lừa đảo",
    description: "Dụ chuyển tiền, link giả mạo hoặc hành vi chiếm đoạt.",
  },
  {
    value: "harassment",
    label: "Quấy rối",
    description: "Xúc phạm, công kích hoặc làm phiền nhiều lần.",
  },
  {
    value: "impersonation",
    label: "Giả mạo",
    description: "Mạo danh cá nhân, admin hoặc thương hiệu khác.",
  },
  {
    value: "abuse",
    label: "Nội dung xấu",
    description: "Nội dung phản cảm, kích động hoặc vi phạm cộng đồng.",
  },
  {
    value: "other",
    label: "Khác",
    description: "Các tình huống khác cần admin xem trực tiếp.",
  },
];

const COMMUNITY_REPORT_CATEGORY_META: Record<
  CommunityUserReportCategory,
  {
    label: string;
    className: string;
  }
> = {
  spam: {
    label: "Spam",
    className: "bg-[#eef1ff] text-[#5868ff]",
  },
  scam: {
    label: "Lừa đảo",
    className: "bg-[#fff1ec] text-[#d4525d]",
  },
  harassment: {
    label: "Quấy rối",
    className: "bg-[#fff0f8] text-[#d8589f]",
  },
  impersonation: {
    label: "Giả mạo",
    className: "bg-[#f3edff] text-[#7b19d8]",
  },
  abuse: {
    label: "Nội dung xấu",
    className: "bg-[#fff6df] text-[#a56a00]",
  },
  other: {
    label: "Khác",
    className: "bg-[#eefbf4] text-[#00a46f]",
  },
};

const COMMUNITY_REPORT_STATUS_META: Record<
  CommunityUserReportStatus,
  {
    label: string;
    className: string;
  }
> = {
  pending: {
    label: "Chờ xử lý",
    className: "bg-[#fff1ec] text-[#d4525d]",
  },
  in_review: {
    label: "Đang xem",
    className: "bg-[#eef1ff] text-[#5868ff]",
  },
  resolved: {
    label: "Đã xử lý",
    className: "bg-[#eefbf4] text-[#00a46f]",
  },
  dismissed: {
    label: "Bỏ qua",
    className: "bg-[#f3edff] text-[#7b19d8]",
  },
};

export const getCommunityReportCategoryMeta = (
  category: CommunityUserReportCategory
) => COMMUNITY_REPORT_CATEGORY_META[category];

export const getCommunityReportStatusMeta = (
  status: CommunityUserReportStatus
) => COMMUNITY_REPORT_STATUS_META[status];
