import AdminSettingsLayout from "@/components/admin/settings/AdminSettingsLayout";
import { adminService } from "@/services/adminService";
import type { FinanceProcessingMode, FinanceSettings } from "@/types/finance";
import axios from "axios";
import { Landmark, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface FinanceSettingsFormState {
  minDepositAmount: string;
  minWithdrawalAmount: string;
  withdrawalFeePercent: string;
  processingMode: FinanceProcessingMode;
}

interface FinanceLiveSummary {
  pendingDeposits: number;
  pendingWithdrawals: number;
  totalDepositAmount: number;
  totalWithdrawalAmount: number;
  activeAccounts: number;
  pausedAccounts: number;
}

const emptySummary: FinanceLiveSummary = {
  pendingDeposits: 0,
  pendingWithdrawals: 0,
  totalDepositAmount: 0,
  totalWithdrawalAmount: 0,
  activeAccounts: 0,
  pausedAccounts: 0,
};

const createFormState = (settings: FinanceSettings): FinanceSettingsFormState => ({
  minDepositAmount: String(settings.minDepositAmount),
  minWithdrawalAmount: String(settings.minWithdrawalAmount),
  withdrawalFeePercent: String(settings.withdrawalFeePercent),
  processingMode: settings.processingMode,
});

const toSettingsPayload = (formState: FinanceSettingsFormState) => ({
  minDepositAmount: Number(formState.minDepositAmount),
  minWithdrawalAmount: Number(formState.minWithdrawalAmount),
  depositBonusPercent: 0,
  withdrawalFeePercent: Number(formState.withdrawalFeePercent),
  processingMode: formState.processingMode,
});

const formatVnd = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} VND`;

const getErrorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? error.response?.data?.message ?? fallback : fallback;

export default function AdminSettingsFinancePage() {
  const [settings, setSettings] = useState<FinanceSettingsFormState | null>(null);
  const [initialSettings, setInitialSettings] = useState<FinanceSettingsFormState | null>(null);
  const [summary, setSummary] = useState<FinanceLiveSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const hasChanges = useMemo(() => {
    if (!settings || !initialSettings) {
      return false;
    }

    return JSON.stringify(settings) !== JSON.stringify(initialSettings);
  }, [initialSettings, settings]);

  useEffect(() => {
    let active = true;

    const syncPageData = async () => {
      try {
        setLoading(true);
        const [settingsRes, depositsRes, withdrawalsRes, accountsRes] = await Promise.all([
          adminService.getFinanceSettings(),
          adminService.getDepositRequests(),
          adminService.getWithdrawalRequests(),
          adminService.getDepositAccounts(),
        ]);

        if (!active) {
          return;
        }

        const nextFormState = createFormState(settingsRes.settings);

        setSettings(nextFormState);
        setInitialSettings(nextFormState);
        setSummary({
          pendingDeposits: depositsRes.summary.pendingCount,
          pendingWithdrawals: withdrawalsRes.summary.pendingCount,
          totalDepositAmount: depositsRes.summary.totalAmount,
          totalWithdrawalAmount: withdrawalsRes.summary.totalAmount,
          activeAccounts: accountsRes.summary.activeCount,
          pausedAccounts: accountsRes.summary.pausedCount,
        });
      } catch (error) {
        console.error("Không tải được dữ liệu cài đặt tài chính", error);

        if (!active) {
          return;
        }

        toast.error(getErrorMessage(error, "Không tải được dữ liệu cài đặt tài chính."));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void syncPageData();

    return () => {
      active = false;
    };
  }, []);

  const updateField = <K extends keyof FinanceSettingsFormState>(
    field: K,
    value: FinanceSettingsFormState[K]
  ) => {
    setSettings((current) => (current ? { ...current, [field]: value } : current));
  };

  const handleSave = async () => {
    if (!settings) {
      return;
    }

    const payload = toSettingsPayload(settings);

    if (
      !Number.isFinite(payload.minDepositAmount) ||
      !Number.isFinite(payload.minWithdrawalAmount) ||
      !Number.isFinite(payload.withdrawalFeePercent)
    ) {
      toast.error("Vui lòng nhập đầy đủ các giá trị tài chính hợp lệ.");
      return;
    }

    try {
      setSaving(true);
      const res = await adminService.updateFinanceSettings(payload);
      const nextFormState = createFormState(res.settings);

      setSettings(nextFormState);
      setInitialSettings(nextFormState);
      toast.success(res.message || "Đã lưu cấu hình tài chính.");
    } catch (error) {
      console.error("Không lưu được cấu hình tài chính", error);
      toast.error(getErrorMessage(error, "Không lưu được cấu hình tài chính."));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!initialSettings) {
      return;
    }

    setSettings(initialSettings);
    toast.info("Đã hoàn tác thay đổi.");
  };

  return (
    <AdminSettingsLayout
      currentSection="finance"
      subtitle="Thiết lập hạn mức nạp/rút, phí rút và chế độ xử lý bằng dữ liệu thật từ backend."
      hasChanges={hasChanges}
      onSave={() => void handleSave()}
      onCancel={handleCancel}
    >
      <section className="grid gap-6 xl:grid-cols-4">
        {[
          {
            label: "Lệnh nạp chờ",
            value: summary.pendingDeposits,
            helper: formatVnd(summary.totalDepositAmount),
          },
          {
            label: "Lệnh rút chờ",
            value: summary.pendingWithdrawals,
            helper: formatVnd(summary.totalWithdrawalAmount),
          },
          {
            label: "TK nhận tiền hoạt động",
            value: summary.activeAccounts,
            helper: `${summary.pausedAccounts} tài khoản tạm ngưng`,
          },
          {
            label: "Trạng thái",
            value: loading ? "..." : "Live",
            helper: "Cấu hình đã nối backend",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-[1.55rem] bg-white p-6 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]"
          >
            <p className="text-sm font-medium text-[#6d7282]">{card.label}</p>
            <p className="mt-2 font-auth-headline text-[2rem] font-extrabold tracking-[-0.04em] text-[#2d2f32]">
              {card.value}
            </p>
            <p className="mt-3 text-xs font-bold text-[#7b8190]">{card.helper}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[1.75rem] bg-[#fcfbff] p-8 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.1)] ring-1 ring-[#eee7f8]">
          <h2 className="flex items-center gap-2 font-auth-headline text-xl font-bold text-[#2d2f32]">
            <Wallet className="size-5 text-[#7b19d8]" />
            Giao dịch
          </h2>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4">
              <div>
                <p className="text-sm font-bold text-[#2d2f32]">Nạp tiền tối thiểu</p>
                <p className="text-xs text-[#7b8190]">Được áp dụng ngay vào luồng nạp tiền.</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={settings?.minDepositAmount ?? ""}
                  onChange={(event) =>
                    updateField("minDepositAmount", event.target.value.replace(/\D/g, ""))
                  }
                  disabled={loading || saving}
                  className="h-10 w-32 rounded-xl border-none bg-[#f3edff] px-3 text-right text-sm font-bold text-[#7b19d8] outline-none disabled:opacity-60"
                />
                <span className="text-xs font-bold text-[#5f6674]">VND</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4">
              <div>
                <p className="text-sm font-bold text-[#2d2f32]">Rút tiền tối thiểu</p>
                <p className="text-xs text-[#7b8190]">Dùng cho cả frontend và validation backend.</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={settings?.minWithdrawalAmount ?? ""}
                  onChange={(event) =>
                    updateField("minWithdrawalAmount", event.target.value.replace(/\D/g, ""))
                  }
                  disabled={loading || saving}
                  className="h-10 w-32 rounded-xl border-none bg-[#f3edff] px-3 text-right text-sm font-bold text-[#7b19d8] outline-none disabled:opacity-60"
                />
                <span className="text-xs font-bold text-[#5f6674]">VND</span>
              </div>
            </div>

            <div className="rounded-2xl bg-[#f8f5ff] p-4 text-sm leading-6 text-[#746d86]">
              <div>
                <p className="text-sm font-bold text-[#2d2f32]">Ghi nhận tiền nạp thật</p>
                <p className="mt-1 text-xs text-[#7b8190]">
                  Hệ thống chỉ ghi nhận đúng số tiền người dùng đã nạp vào ví. Không còn cấu hình cộng thêm tự động trong khu vực này.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4">
              <div>
                <p className="text-sm font-bold text-[#2d2f32]">Phí rút tiền</p>
                <p className="text-xs text-[#7b8190]">Tính vào số tiền thực nhận của user khi tạo lệnh.</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={settings?.withdrawalFeePercent ?? ""}
                  onChange={(event) => updateField("withdrawalFeePercent", event.target.value)}
                  disabled={loading || saving}
                  className="h-10 w-20 rounded-xl border-none bg-[#f3edff] px-3 text-right text-sm font-bold text-[#7b19d8] outline-none disabled:opacity-60"
                />
                <span className="text-xs font-bold text-[#5f6674]">%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] bg-white p-8 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]">
          <h2 className="flex items-center gap-2 font-auth-headline text-xl font-bold text-[#2d2f32]">
            <Landmark className="size-5 text-[#5868ff]" />
            Xử lý Lệnh
          </h2>

          <div className="mt-6 space-y-4">
            <div>
              <p className="text-sm text-[#7b8190]">Chế độ xử lý lệnh rút</p>
              <select
                value={settings?.processingMode ?? "standard"}
                onChange={(event) =>
                  updateField("processingMode", event.target.value as FinanceProcessingMode)
                }
                disabled={loading || saving}
                className="mt-3 h-12 w-full rounded-2xl border-none bg-[#f3edff] px-4 text-sm font-semibold text-[#2d2f32] outline-none disabled:opacity-60"
              >
                <option value="instant">Tức thì (Dưới 5 phút)</option>
                <option value="standard">Tiêu chuẩn (2 - 6 giờ)</option>
                <option value="manual">Thủ công (Trong vòng 24 giờ)</option>
              </select>
            </div>

            <div className="rounded-2xl bg-[#eef1ff] p-4 text-xs leading-6 text-[#5868ff]">
              {settings?.withdrawalFeePercent && Number(settings.withdrawalFeePercent) > 0
                ? `User sẽ thấy phí rút ${settings.withdrawalFeePercent}% và số tiền thực nhận theo cấu hình hiện tại.`
                : "Hệ thống đang để miễn phí rút tiền cho người dùng."}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-[#faf8ff] px-4 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f95a3]">
                  Khối lượng nạp
                </p>
                <p className="mt-2 text-base font-bold text-[#2d2f32]">
                  {formatVnd(summary.totalDepositAmount)}
                </p>
              </div>
              <div className="rounded-2xl bg-[#faf8ff] px-4 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f95a3]">
                  Khối lượng rút
                </p>
                <p className="mt-2 text-base font-bold text-[#2d2f32]">
                  {formatVnd(summary.totalWithdrawalAmount)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </AdminSettingsLayout>
  );
}
