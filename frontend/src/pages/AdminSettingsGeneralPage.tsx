import AdminSettingsLayout from "@/components/admin/settings/AdminSettingsLayout";
import { BrandLogo } from "@/components/branding/brand-logo";
import { AppWindow } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const initialGeneralSettings = {
  appName: "Kiếm Tương Tác",
  supportEmail: "support@kiemtuongtac.vn",
};

export default function AdminSettingsGeneralPage() {
  const [settings, setSettings] = useState(initialGeneralSettings);
  const hasChanges = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(initialGeneralSettings),
    [settings]
  );

  const updateField = <K extends keyof typeof initialGeneralSettings>(
    field: K,
    value: (typeof initialGeneralSettings)[K]
  ) => {
    setSettings((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleReset = () => {
    setSettings(initialGeneralSettings);
    toast.info("Đã khôi phục cấu hình mặc định.");
  };

  const handleSave = () => {
    toast.success("Đã lưu cấu hình chung ở frontend. Backend sẽ nối ở bước sau.");
  };

  const handleCancel = () => {
    setSettings(initialGeneralSettings);
    toast.info("Đã hủy thay đổi.");
  };

  return (
    <AdminSettingsLayout
      currentSection="general"
      subtitle="Quản lý thương hiệu, thông tin hỗ trợ và nhận diện chung của hệ thống admin."
      hasChanges={hasChanges}
      onSave={handleSave}
      onCancel={handleCancel}
    >
      <section className="rounded-[1.75rem] bg-white p-8 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-auth-headline text-xl font-bold text-[#2d2f32]">
              <AppWindow className="size-5 text-[#7b19d8]" />
              Cấu hình Chung
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[#767d8c]">
              Quản lý thương hiệu, kênh hỗ trợ và nhận diện chính của hệ thống admin.
            </p>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="text-sm font-semibold text-[#5868ff] transition-colors hover:text-[#7b19d8]"
          >
            Khôi phục mặc định
          </button>
        </div>

        <div className="mt-8 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#6d7282]">Tên ứng dụng</label>
              <input
                value={settings.appName}
                onChange={(event) => updateField("appName", event.target.value)}
                className="h-12 w-full rounded-2xl border-none bg-[#f3edff] px-4 text-sm text-[#2d2f32] outline-none ring-2 ring-transparent transition-all focus:bg-white focus:ring-[#7b19d8]/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#6d7282]">Email hỗ trợ</label>
              <input
                value={settings.supportEmail}
                onChange={(event) => updateField("supportEmail", event.target.value)}
                className="h-12 w-full rounded-2xl border-none bg-[#f3edff] px-4 text-sm text-[#2d2f32] outline-none ring-2 ring-transparent transition-all focus:bg-white focus:ring-[#7b19d8]/20"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#6d7282]">Logo hệ thống</label>
            <div className="flex flex-col gap-4 rounded-[1.5rem] border-2 border-dashed border-[#eadbfd] bg-[#fcfbff] p-5 sm:flex-row sm:items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f3edff]">
                <BrandLogo imageClassName="h-10" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#2d2f32]">Nhận diện thương hiệu hiện tại</p>
                <p className="mt-1 text-xs text-[#7b8190]">
                  PNG, JPG tối đa 2MB. Chức năng upload file thật sẽ nối ở bước sau.
                </p>
              </div>
              <button
                type="button"
                onClick={() => toast.info("Upload logo mới sẽ được cập nhật sau.")}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-bold text-[#2d2f32] shadow-[0_14px_30px_-24px_rgba(123,25,216,0.26)] transition-colors hover:text-[#7b19d8]"
              >
                Chọn tệp
              </button>
            </div>
          </div>
        </div>
      </section>
    </AdminSettingsLayout>
  );
}
