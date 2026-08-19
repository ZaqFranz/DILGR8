// Ordered ascending (lowest to highest attainment) - mirrors the
// EducationLevel enum in schema.prisma. The order itself is meaningful:
// JobPosting.minEducationLevel is compared against Applicant.educationLevel
// by ordinal position (index in this array) to compute an automatic
// Sifting hint - see docs/decisions.md. Mirrored on the frontend
// (frontend/src/shared/constants/educationLevels.ts) for the same reason
// SALARY_GRADE_VALUES is mirrored: both z.enum() (here) and a <select>'s
// options (there) need the same literal list.
export const EDUCATION_LEVEL_VALUES = [
  "ELEMENTARY",
  "HIGH_SCHOOL",
  "VOCATIONAL",
  "COLLEGE_LEVEL",
  "BACHELORS",
  "MASTERS_LEVEL",
  "MASTERS",
  "DOCTORATE_LEVEL",
  "DOCTORATE",
] as const;

export type EducationLevelValue = (typeof EDUCATION_LEVEL_VALUES)[number];

export const EDUCATION_LEVEL_LABELS: Record<EducationLevelValue, string> = {
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

export function educationLevelRank(level: EducationLevelValue): number {
  return EDUCATION_LEVEL_VALUES.indexOf(level);
}
