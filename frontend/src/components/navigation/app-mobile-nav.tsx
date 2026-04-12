import { getRoleAccountPath } from "@/lib/role-routing";
import { useAuthStore } from "@/stores/useAuthStore";
import { Home, ListTodo, UserRound, Wallet } from "lucide-react";
import { NavLink } from "react-router";

export function AppMobileNav() {
  const { user } = useAuthStore();
  const accountPath = getRoleAccountPath(user?.role);
  const baseItemClassName =
    "flex min-w-0 flex-1 flex-col items-center justify-center rounded-[1.05rem] px-2 py-2 text-center text-slate-400 transition-transform duration-200 active:scale-95 dark:text-slate-500";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50">
      <div className="mobile-floating-shell pb-[calc(env(safe-area-inset-bottom)+0.85rem)] pt-1.5">
        <div className="flex items-center gap-2 rounded-t-[1.65rem] rounded-b-[1.5rem] bg-white/82 px-2.5 py-2.5 shadow-[0_-8px_40px_rgba(123,25,216,0.12)] backdrop-blur-2xl dark:bg-[#170d27]/88">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `${baseItemClassName} ${
                isActive
                  ? "bg-gradient-primary text-white shadow-soft"
                  : "text-slate-400 dark:text-slate-500"
              }`
            }
          >
            <Home className="size-4.5 min-[380px]:size-5" />
            <span className="mt-1 block w-full text-[0.62rem] font-semibold uppercase tracking-[0.12em] min-[380px]:text-[0.68rem]">
              Trang chủ
            </span>
          </NavLink>

          <NavLink
            to="/tasks"
            className={({ isActive }) =>
              `${baseItemClassName} ${
                isActive
                  ? "bg-gradient-primary text-white shadow-soft"
                  : "text-slate-400 dark:text-slate-500"
              }`
            }
          >
            <ListTodo className="size-4.5 min-[380px]:size-5" />
            <span className="mt-1 block w-full text-[0.62rem] font-semibold uppercase tracking-[0.12em] min-[380px]:text-[0.68rem]">
              Nhiệm vụ
            </span>
          </NavLink>

          <NavLink
            to="/wallet"
            className={({ isActive }) =>
              `${baseItemClassName} ${
                isActive
                  ? "bg-gradient-primary text-white shadow-soft"
                  : "text-slate-400 dark:text-slate-500"
              }`
            }
          >
            <Wallet className="size-4.5 min-[380px]:size-5" />
            <span className="mt-1 block w-full text-[0.62rem] font-semibold uppercase tracking-[0.12em] min-[380px]:text-[0.68rem]">
              Ví
            </span>
          </NavLink>

          <NavLink
            to={accountPath}
            className={({ isActive }) =>
              `${baseItemClassName} ${
                isActive
                  ? "bg-gradient-primary text-white shadow-soft"
                  : "text-slate-400 dark:text-slate-500"
              }`
            }
          >
            <UserRound className="size-4.5 min-[380px]:size-5" />
            <span className="mt-1 block w-full text-[0.62rem] font-semibold uppercase tracking-[0.12em] min-[380px]:text-[0.68rem]">
              Cá nhân
            </span>
          </NavLink>
        </div>
      </div>
    </nav>
  );
}
