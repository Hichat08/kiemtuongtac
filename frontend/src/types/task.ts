export type TaskPlatform = "facebook" | "tiktok" | "youtube" | "other";
export type TaskStatus = "running" | "pending" | "completed" | "paused";
export type TaskSubmissionStatus = "pending" | "approved" | "rejected";

export interface TaskCatalogItem {
  id: string;
  code: string;
  title: string;
  brand: string;
  platform: TaskPlatform;
  reward: number;
  current: number;
  target: number;
  availableSlots: number;
  status: TaskStatus;
  description: string;
  actionLabel: string;
  hot: boolean;
  submissionStatus?: TaskSubmissionStatus | null;
  latestSubmissionId?: string | null;
  latestSubmissionAt?: string | null;
  latestReviewNote?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface TaskSubmissionRow {
  id: string;
  taskId: string;
  taskCode: string;
  taskTitle: string;
  taskBrand: string;
  platform: TaskPlatform;
  reward: number;
  userName?: string;
  userId?: string;
  proofLink: string;
  screenshotUrl: string;
  note: string;
  status: TaskSubmissionStatus;
  reviewNote: string;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
}

export interface UserTasksResponse {
  summary: {
    totalVisible: number;
    hot: number;
    totalAvailableSlots: number;
  };
  tasks: TaskCatalogItem[];
}

export interface UserTaskDetailResponse {
  task: TaskCatalogItem;
  latestSubmission: TaskSubmissionRow | null;
  relatedAvailableCount: number;
}

export interface UserTaskHistoryResponse {
  summary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    totalEarned: number;
  };
  submissions: TaskSubmissionRow[];
}
