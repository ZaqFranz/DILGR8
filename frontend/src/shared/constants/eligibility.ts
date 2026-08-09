import type { EligibilityType } from "@/features/applicant-registration/types";

export const ELIGIBILITY_OPTIONS: { value: EligibilityType; label: string }[] = [
  { value: "RA1080", label: "RA 1080" },
  { value: "CSC_PROFESSIONAL", label: "CSC Professional" },
  { value: "CSC_SUBPROFESSIONAL", label: "CSC Sub-Professional" },
  { value: "BARANGAY", label: "Barangay Eligibility" },
];

export const ELIGIBILITY_LABELS: Record<EligibilityType, string> = {
  RA1080: "RA 1080",
  CSC_PROFESSIONAL: "CSC Professional",
  CSC_SUBPROFESSIONAL: "CSC Sub-Professional",
  BARANGAY: "Barangay Eligibility",
  NONE: "None",
};
