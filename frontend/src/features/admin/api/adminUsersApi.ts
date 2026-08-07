import { apiRequest } from "@/shared/api/apiClient";
import type { AdminUser, CreateUserInput, UpdateUserInput } from "../types";

export function listUsers(): Promise<AdminUser[]> {
  return apiRequest<AdminUser[]>("/users");
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
