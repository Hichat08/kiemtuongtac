import AdminSettingsLayout from "@/components/admin/settings/AdminSettingsLayout";
import { Switch } from "@/components/ui/switch";
import { BadgePercent, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const initialTaskSettings = {
  userCommission: 85,
  minTaskReward: "500",
  autoApproveTask: true,
};

export default function AdminSettingsTasksPage() {
  const [settings, setSettings] = useState(initialTaskSettings);
  const hasChanges = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(initialTaskSettings),
    [settings]
  );

  const updateField = <K extends keyof typeof initialTaskSettings>(
    field: K,
    value: (typeof initialTaskSettings)[K]
  ) => {
    setSettings((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSave = () => {
    toast.success("Đã lưu cấu hình nhiệm vụ ở frontend. Backend sẽ nối ở bước sau.");
  };

  const handleCancel = () => {
    setSettings(initialTaskSettings);
    toast.info("Đã hủy thay đổi.");
  };

  return (
    <AdminSettingsLayout
      currentSection="tasks"
      subtitle="Thiết lập hoa hồng, mức thưởng tối thiểu và quy tắc duyệt nhiệm vụ trong hệ thống."
      hasChanges={hasChanges}
      onSave={handleSave}
      onCancel={handleCancel}
    >
      <section className="rounded-[1.75rem] bg-white p-8 shadow-[0_24px_55px_-38px_rgba(123,25,216,0.12)]">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-6">
            <h2 className="flex items-center gap-2 font-auth-headline text-xl font-bold text-[#2d2f32]">
              <BadgePercent className="size-5 text-[#5868ff]" />
              Cấu hình Nhiệm vụ
            </h2>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-[#2d2f32]">Tỷ lệ hoa hồng người dùng</label>
                <span className="text-sm font-bold text-[#7b19d8]">{settings.userCommission}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={95}
                value={settings.userCommission}
                onChange={(event) => updateField("userCommission", Number(event.target.value))}
                className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-[#ece6f7] accent-[#7b19d8]"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-[#f8f5ff] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f95a3]">Giá tối thiểu</p>
                <div className="mt-2 flex items-center justify-between">
                  <input
                    value={settings.minTaskReward}
                    onChange={(event) => updateField("minTaskReward", event.target.value.replace(/\D/g, ""))}
                    className="w-24 border-none bg-transparent text-lg font-bold text-[#2d2f32] outline-none"
                  />
                  <span className="text-sm font-semibold text-[#7b8190]">đ</span>
                </div>
              </div>

              <div className="rounded-2xl bg-[#f8f5ff] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f95a3]">Duyệt tự động</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className={`text-sm font-bold ${settings.autoApproveTask ? "text-[#7b19d8]" : "text-[#7b8190]"}`}>
                    {settings.autoApproveTask ? "Bật" : "Tắt"}
                  </span>
                  <Switch
                    checked={settings.autoApproveTask}
                    onCheckedChange={(checked) => updateField("autoApproveTask", checked)}
                    className="data-[state=checked]:bg-[#7b19d8] data-[state=unchecked]:bg-[#dcd6e8]"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] bg-[#fcfbff] p-6 ring-1 ring-[#eee7f8]">
            <p className="flex items-center gap-2 text-sm font-bold text-[#7b19d8]">
              <Sparkles className="size-4" />
              Mẹo quản lý
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[#707786]">
              <li>Tăng tỷ lệ hoa hồng để thu hút người dùng mới.</li>
              <li>Giảm giá tối thiểu nếu số lượng task đang thấp.</li>
              <li>Duyệt tự động nên chỉ bật khi bài toán xác minh đã ổn định.</li>
            </ul>
          </div>
        </div>
      </section>
    </AdminSettingsLayout>
  );
}
