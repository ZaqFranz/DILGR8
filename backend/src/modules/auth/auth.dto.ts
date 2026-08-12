import type { Role } from "@prisma/client";
import { z } from "zod";
import { passwordPolicySchema } from "@/shared/utils/password";

export const registerSchema = z.object({
  email: z.string().email(),
  password: passwordPolicySchema,
});
export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginDto = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordPolicySchema,
});
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;

export interface AuthResponseDto {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: Role;
    mustChangePassword: boolean;
  };
}
