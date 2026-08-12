import type { ApplicationStatus } from "@/features/admin/types";

// Single source of truth for how an Application's status reads to a human,
// so the admin Evaluate Applicants table, the Dashboard's status chart, and
// the applicant's own My Applications page can never drift out of sync with
// each other (they previously did: FOR_INTERVIEW rendered as the raw enum
// string "FOR_INTERVIEW" on the admin/applicant badges, while the stage
// tracker and the Dashboard each had their own separate "For Interview"
// wording). FOR_INTERVIEW reads "Evaluation of Applicants" to match the
// applicant-facing stage tracker's renamed label (see
// ApplicationStageTracker.tsx) - the underlying status value/enum, badge
// CSS class (`.badge.for_interview`), and all status-comparison logic are
// unchanged; this only affects the text a human reads.
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_SIFTING: "Under Sifting",
  FOR_INTERVIEW: "Evaluation of Applicants",
  QUALIFIED: "Qualified",
  NOT_QUALIFIED: "Not Qualified",
  FOR_COMPLIANCE: "Compliance to Requirements",
  NOT_SELECTED: "Not Selected",
  DISQUALIFIED: "Disqualified",
  FOR_OATH_TAKING: "Oath-Taking",
  HIRED: "Hired",
  WITHDRAWN: "Withdrawn",
};
