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
// scheduledEndAt is optional - the Evaluation of Applicants phase runs up to
// 2 days (docs/rsp-domain-spec.md), but a single-day evaluation is also
// valid, so only day 2 needs an explicit end date/time.
export const scheduleInterviewSchema = z
  .object({
    scheduledAt: z.coerce.date(),
    scheduledEndAt: z.coerce.date().optional(),
    venue: z.string().min(1).max(2000),
    attire: z.string().max(500).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((data) => !data.scheduledEndAt || data.scheduledEndAt.getTime() >= data.scheduledAt.getTime(), {
    message: "Day 2 date/time can't be earlier than day 1",
    path: ["scheduledEndAt"],
  });
export type ScheduleInterviewDto = z.infer<typeof scheduleInterviewSchema>;

// Manual alternative to the bulk Excel import (POST /import-exam-scores) -
// same underlying field, just set one application at a time instead of
// requiring a spreadsheet for every score.
export const setExamScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
});
export type SetExamScoreDto = z.infer<typeof setExamScoreSchema>;

export const applicationComplianceItemParamSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
});

// The admin's per-requirement verdict on an applicant's submitted proof -
// see docs/rsp-domain-spec.md's Compliance to Requirements phase.
export const reviewComplianceItemSchema = z.object({
  status: z.enum(["VERIFIED", "REJECTED"]),
  remarks: z.string().max(2000).optional(),
});
export type ReviewComplianceItemDto = z.infer<typeof reviewComplianceItemSchema>;

// Bundles the FOR_COMPLIANCE -> FOR_OATH_TAKING transition with the
// ceremony's schedule itself, the same shape scheduleInterviewSchema uses
// for FOR_INTERVIEW - one admin action rather than a bare status flip
// followed by a separate scheduling step.
export const scheduleOathTakingSchema = z.object({
  scheduledAt: z.coerce.date(),
  venue: z.string().min(1).max(2000),
  notes: z.string().max(2000).optional(),
});
export type ScheduleOathTakingDto = z.infer<typeof scheduleOathTakingSchema>;

// Shared by rejectAfterInterview (FOR_INTERVIEW -> NOT_SELECTED) and
// rejectAfterCompliance (FOR_COMPLIANCE -> DISQUALIFIED) - both are the same
// kind of one-shot "regret" decision, just from a different stage.
export const rejectApplicationSchema = z.object({
  remarks: z.string().max(2000).optional(),
});
export type RejectApplicationDto = z.infer<typeof rejectApplicationSchema>;
