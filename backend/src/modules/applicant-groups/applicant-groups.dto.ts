import { z } from "zod";

// A group only makes sense with more than one member - min(2) rejects the
// degenerate "group of one" case at the boundary rather than leaving it to
// be caught (or not) downstream.
export const createApplicantGroupSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  applicationIds: z.array(z.string().uuid()).min(2).max(100),
});
export type CreateApplicantGroupDto = z.infer<typeof createApplicantGroupSchema>;

// Renames/redescribes a group and/or replaces its membership. applicationIds,
// when present, is the group's new full member list (diffed against what's
// on file by the repository - add what's new, remove what's missing) rather
// than an add/remove delta, the same "send the whole desired list" shape
// createApplicantGroupSchema already uses.
export const updateApplicantGroupSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  applicationIds: z.array(z.string().uuid()).min(2).max(100).optional(),
});
export type UpdateApplicantGroupDto = z.infer<typeof updateApplicantGroupSchema>;
