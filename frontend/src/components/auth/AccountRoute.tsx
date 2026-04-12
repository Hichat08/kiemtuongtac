import { getRoleAccountPath } from "@/lib/role-routing";
import { useAuthStore } from "@/stores/useAuthStore";
import { Navigate } from "react-router";

export default function AccountRoute() {
  const { user } = useAuthStore();

  return (
    <Navigate
      to={getRoleAccountPath(user?.role)}
      replace
    />
  );
}
