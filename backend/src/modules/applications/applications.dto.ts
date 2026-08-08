import { z } from "zod";

export const createApplicationSchema = z.object({
  jobPostingId: z.string().uuid(),
});
export type CreateApplicationDto = z.infer<typeof createApplicationSchema>;

export const listApplicationsQuerySchema = z.object({
  jobPostingId: z.string().uuid().optional(),
});
export type ListApplicationsQueryDto = z.infer<typeof listApplicationsQuerySchema>;

// The Sifting decision: pass/fail against the posting's qualification
// standards (education/training/experience/eligibility) - see
// docs/rsp-domain-spec.md's Sifting phase.
export const siftApplicationSchema = z.object({
  decision: z.enum(["QUALIFIED", "NOT_QUALIFIED"]),
  remarks: z.string().max(2000).optional(),
});
export type SiftApplicationDto = z.infer<typeof siftApplicationSchema>;

// Admin fills these in when moving an application to FOR_INTERVIEW, so the
// notification email can actually tell the applicant when/where to show up
// and what to wear, instead of a vague "the panel will be in touch."
export const scheduleInterviewSchema = z.object({
  scheduledAt: z.coerce.date(),
  venue: z.string().min(1).max(2000),
  attire: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});
export type ScheduleInterviewDto = z.infer<typeof scheduleInterviewSchema>;
