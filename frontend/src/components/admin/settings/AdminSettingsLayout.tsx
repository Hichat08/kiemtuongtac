import AdminShell from "@/components/admin/AdminShell";
import { Save } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "react-router";

export type AdminSettingsSection = "general" | "finance" | "tasks" | "security";

const settingsNavItems: Array<{ id: AdminSettingsSection; label: string; href: string }> = [
  { id: "general", label: "Cấu hình Chung", href: "/admin/settings/general" },
  { id: "finance", label: "Quản lý Tài chính", href: "/admin/settings/finance" },
  { id: "tasks", label: "Quản lý Nhiệm vụ", href: "/admin/settings/tasks" },
  { id: "security", label: "Bảo mật & Hệ thống", href: "/admin/settings/security" },
];

interface AdminSettingsLayoutProps {
  currentSection: AdminSettingsSection;
  subtitle: string;
  hasChanges: boolean;
  onSave: () => void;
  onCancel: () => void;
  children: ReactNode;
}

export default function AdminSettingsLayout({
  currentSection,
  subtitle,
  hasChanges,
  onSave,
  onCancel,
  children,
}: AdminSettingsLayoutProps) {
  return (
    <AdminShell
      title="Cài đặt hệ thống"
      subtitle={subtitle}
      searchValue=""
      onSearchChange={() => undefined}
      searchPlaceholder="Tìm kiếm cấu hình..."
      sidebarActionLabel="Lưu cấu hình"
      onSidebarActionClick={onSave}
      action={null}
    >
      <section className="space-y-6">
        <div className="overflow-x-auto pb-2">
          <nav className="flex min-w-max items-center gap-3 rounded-[1.75rem] bg-[#efe8fb] p-2">
            {settingsNavItems.map((section) => (
              <NavLink
                key={section.id}
                to={section.href}
                end
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-[1.2rem] px-5 py-3 text-sm font-semibold transition-all ${
                    isActive || currentSection === section.id
                      ? "bg-white text-[#7b19d8] shadow-[0_18px_40px_-28px_rgba(123,25,216,0.22)] ring-1 ring-[#eadbfd]"
                      : "text-[#707786] hover:bg-white/55 hover:text-[#7b19d8]"
                  }`
                }
              >
                {section.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {children}

        <section className="flex flex-wrap justify-end gap-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={!hasChanges}
            className="rounded-full px-6 py-3 text-sm font-bold text-[#7b8190] transition-colors hover:bg-[#f1ecfb] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Hủy thay đổi
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!hasChanges}
            className="auth-premium-gradient auth-soft-shadow inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="size-4" />
            Lưu cấu hình
          </button>
        </section>
      </section>
    </AdminShell>
  );
}
