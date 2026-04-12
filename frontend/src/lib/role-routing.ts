import type { User } from "@/types/user";

export const getRoleHomePath = (role?: User["role"]) =>
  role === "admin" ? "/admin" : "/";

export const getRoleAccountPath = (role?: User["role"]) =>
  role === "admin" ? "/admin" : "/profile";
