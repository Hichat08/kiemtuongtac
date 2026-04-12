import { Navigate } from "react-router";

export default function AdminSettingsPage() {
  return (
    <Navigate
      to="/admin/settings/general"
      replace
    />
  );
}
