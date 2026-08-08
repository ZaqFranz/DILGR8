import { apiRequest } from "@/shared/api/apiClient";
import type { AdminUser, CreateUserInput, UpdateUserInput, UserRole } from "../types";

export function listUsers(filters?: { role?: UserRole; search?: string }): Promise<AdminUser[]> {
  const params = new URLSearchParams();
  if (filters?.role) params.set("role", filters.role);
  if (filters?.search) params.set("search", filters.search);
  const query = params.toString();
  return apiRequest<AdminUser[]>(`/users${query ? `?${query}` : ""}`);
}

export function createUser(input: CreateUserInput): Promise<AdminUser> {
  return apiRequest<AdminUser>("/users", { method: "POST", body: input });
}

export function updateUser(id: string, input: UpdateUserInput): Promise<AdminUser> {
  return apiRequest<AdminUser>(`/users/${id}`, { method: "PATCH", body: input });
}

export function deleteUser(id: string): Promise<void> {
  return apiRequest<void>(`/users/${id}`, { method: "DELETE" });
}
