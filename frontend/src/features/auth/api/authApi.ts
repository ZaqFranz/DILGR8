import { apiRequest } from "@/shared/api/apiClient";
import type { AuthResponse, Credentials } from "../types";

export function register(credentials: Credentials): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/register", { method: "POST", body: credentials });
}

export function login(credentials: Credentials): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/login", { method: "POST", body: credentials });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiRequest<void>("/auth/me/password", { method: "PATCH", body: { currentPassword, newPassword } });
}

export function forgotPassword(email: string): Promise<void> {
  return apiRequest<void>("/auth/forgot-password", { method: "POST", body: { email } });
}
