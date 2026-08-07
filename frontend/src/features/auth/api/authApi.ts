import { apiRequest } from "@/shared/api/apiClient";
import type { AuthResponse, Credentials } from "../types";

export function register(credentials: Credentials): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/register", { method: "POST", body: credentials });
}

export function login(credentials: Credentials): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/login", { method: "POST", body: credentials });
}
