import type { EducationLevel } from "@/features/applicant-registration/types";

// Ordered ascending (lowest to highest attainment) - mirrors the backend's
// EDUCATION_LEVEL_VALUES (backend/src/shared/constants/educationLevels.ts)
// and the EducationLevel enum in schema.prisma. The order itself is
// meaningful: qualificationMatch.ts compares an applicant's index in this
// array against a job posting's minEducationLevel index to compute the
// Sifting "meets/below" hint.
export const EDUCATION_LEVEL_VALUES: EducationLevel[] = [
  "ELEMENTARY",
  "HIGH_SCHOOL",
  "VOCATIONAL",
  "COLLEGE_LEVEL",
  "BACHELORS",
  "MASTERS_LEVEL",
  "MASTERS",
  "DOCTORATE_LEVEL",
  "DOCTORATE",
];

export const EDUCATION_LEVEL_LABELS: Record<EducationLevel, string> = {
  ELEMENTARY: "Elementary Graduate",
  HIGH_SCHOOL: "High School Graduate",
  VOCATIONAL: "Vocational/Trade Course Graduate",
  COLLEGE_LEVEL: "College Level (undergraduate units earned, no degree)",
  BACHELORS: "Bachelor's Degree",
  MASTERS_LEVEL: "Master's Level (units earned, no degree)",
  MASTERS: "Master's Degree",
  DOCTORATE_LEVEL: "Doctorate Level (units earned, no degree)",
  DOCTORATE: "Doctorate Degree",
};

export const EDUCATION_LEVEL_OPTIONS: { value: EducationLevel; label: string }[] = EDUCATION_LEVEL_VALUES.map(
  (value) => ({ value, label: EDUCATION_LEVEL_LABELS[value] }),
);
