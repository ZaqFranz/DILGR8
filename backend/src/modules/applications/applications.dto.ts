import { z } from "zod";

export const createApplicationSchema = z.object({
  jobPostingId: z.string().uuid(),
});
export type CreateApplicationDto = z.infer<typeof createApplicationSchema>;
