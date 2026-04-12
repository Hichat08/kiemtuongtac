import AdminSettingsLayout from "@/components/admin/settings/AdminSettingsLayout";
import { Switch } from "@/components/ui/switch";
import { ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const initialSecuritySettings = {
  maintenanceMode: false,
  requireOtpWithdrawal: true,
  loginAttemptsLimit: 5,
};

export default function AdminSettingsSecurityPage() {
  const [settings, setSettings] = useState(initialSecuritySettings);
  const hasChanges = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(initialSecuritySettings),
    [settings]
  );

  const updateField = <K extends keyof typeof initialSecuritySettings>(
    field: K,
    value: (typeof initialSecuritySettings)[K]
  ) => {
    setSettings((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSave = () => {
    toast.success("Đã lưu cấu hình bảo mật ở frontend. Backend sẽ nối ở bước sau.");
  };

  const handleCancel = () => {
    setSettings(initialSecuritySettings);
    toast.info("Đã hủy thay đổi.");
  };

  return (
    <AdminSettingsLayout
      currentSection="security"
      subtitle="Quản lý chế độ bảo trì, xác thực OTP và giới hạn đăng nhập sai của hệ thống."
      hasChanges={hasChanges}
      onSave={handleSave}
      onCancel={handleCancel}
    >
      <section className="rounded-[1.75rem] bg-[#fbf9ff] p-8 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.08)] ring-1 ring-[#eee7f8]">
        <h2 className="flex items-center gap-2 font-auth-headline text-xl font-bold text-[#2d2f32]">
          <ShieldCheck className="size-5 text-[#d4525d]" />
          Bảo mật & Hệ thống
        </h2>

        <div className="mt-8 grid gap-8 xl:grid-cols-2">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#2d2f32]">Chế độ Bảo trì</p>
                <p className="text-xs text-[#7b8190]">Tạm dừng hoạt động người dùng</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-sm font-bold ${
                    settings.maintenanceMode ? "text-[#d4525d]" : "text-[#7b8190]"
                  }`}
                >
                  {settings.maintenanceMode ? "Bật" : "Tắt"}
                </span>
                <Switch
                  checked={settings.maintenanceMode}
                  onCheckedChange={(checked) => updateField("maintenanceMode", checked)}
                  className="data-[state=checked]:bg-[#d4525d] data-[state=unchecked]:bg-[#dcd6e8]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#2d2f32]">Xác thực OTP</p>
                <p className="text-xs text-[#7b8190]">Yêu cầu OTP khi rút tiền</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-sm font-bold ${
                    settings.requireOtpWithdrawal ? "text-[#7b19d8]" : "text-[#7b8190]"
                  }`}
                >
                  {settings.requireOtpWithdrawal ? "Bật" : "Tắt"}
                </span>
                <Switch
                  checked={settings.requireOtpWithdrawal}
                  onCheckedChange={(checked) => updateField("requireOtpWithdrawal", checked)}
                  className="data-[state=checked]:bg-[#7b19d8] data-[state=unchecked]:bg-[#dcd6e8]"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-[#6d7282]">Giới hạn đăng nhập sai</label>
            <div className="mt-3 flex items-center gap-4 rounded-2xl bg-white p-4">
              <div className="flex flex-1 items-center justify-between rounded-xl bg-[#f3edff] px-4 py-3">
                <span className="text-sm font-bold text-[#2d2f32]">{settings.loginAttemptsLimit} lần</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateField("loginAttemptsLimit", Math.max(1, settings.loginAttemptsLimit - 1))
                    }
                    className="flex size-6 items-center justify-center rounded-md bg-white text-sm font-bold text-[#6d7282]"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField("loginAttemptsLimit", settings.loginAttemptsLimit + 1)}
                    className="flex size-6 items-center justify-center rounded-md bg-white text-sm font-bold text-[#6d7282]"
                  >
                    +
                  </button>
                </div>
              </div>
              <p className="max-w-[8rem] text-xs leading-5 text-[#7b8190]">
                Tài khoản sẽ bị khóa 30 phút khi vượt ngưỡng.
              </p>
            </div>
          </div>
        </div>
      </section>
    </AdminSettingsLayout>
  );
}
