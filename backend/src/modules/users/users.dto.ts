import { z } from "zod";

const roleSchema = z.enum(["APPLICANT", "ADMIN", "PANEL"]);
// Applicants self-register via /register (ApplicantsService), not through
// this admin-only endpoint - only ADMIN/PANEL accounts are created here.
const adminCreatableRoleSchema = z.enum(["ADMIN", "PANEL"]);

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: adminCreatableRoleSchema,
  name: z.string().min(1, "Full name is required").max(200),
});
export type CreateUserDto = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  role: roleSchema.optional(),
  name: z.string().min(1).max(200).optional(),
});
export type UpdateUserDto = z.infer<typeof updateUserSchema>;

export const listUsersQuerySchema = z.object({
  role: roleSchema.optional(),
  search: z.string().min(1).optional(),
});
export type ListUsersQueryDto = z.infer<typeof listUsersQuerySchema>;
