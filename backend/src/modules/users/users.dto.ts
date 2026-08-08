import { z } from "zod";

const roleSchema = z.enum(["APPLICANT", "ADMIN", "PANEL"]);

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: roleSchema,
});
export type CreateUserDto = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  role: roleSchema.optional(),
});
export type UpdateUserDto = z.infer<typeof updateUserSchema>;

export const listUsersQuerySchema = z.object({
  role: roleSchema.optional(),
  search: z.string().min(1).optional(),
});
export type ListUsersQueryDto = z.infer<typeof listUsersQuerySchema>;
