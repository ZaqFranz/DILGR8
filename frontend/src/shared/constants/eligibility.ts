import type { EligibilityType } from "@/features/applicant-registration/types";

// RA1080 and BARANGAY are deliberately not offered as choices (client
// request) - kept in ELIGIBILITY_LABELS below so any existing data still
// carrying one of those values (already-registered applicants, job
// postings created before this change) keeps rendering a proper label
// instead of blank/undefined, without a destructive schema migration.
export const ELIGIBILITY_OPTIONS: { value: EligibilityType; label: string }[] = [
  { value: "CSC_PROFESSIONAL", label: "Second-Level Eligibility (Professional)" },
  { value: "CSC_SUBPROFESSIONAL", label: "First-Level Eligibility (Subprofessional)" },
];

export const ELIGIBILITY_LABELS: Record<EligibilityType, string> = {
  RA1080: "RA 1080",
  CSC_PROFESSIONAL: "Second-Level Eligibility (Professional)",
  CSC_SUBPROFESSIONAL: "First-Level Eligibility (Subprofessional)",
  BARANGAY: "Barangay Eligibility",
  NONE: "None",
};
