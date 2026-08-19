export type EligibilityType = "RA1080" | "CSC_PROFESSIONAL" | "CSC_SUBPROFESSIONAL" | "BARANGAY" | "NONE";
export type EducationLevel =
  | "ELEMENTARY"
  | "HIGH_SCHOOL"
  | "VOCATIONAL"
  | "COLLEGE_LEVEL"
  | "BACHELORS"
  | "MASTERS_LEVEL"
  | "MASTERS"
  | "DOCTORATE_LEVEL"
  | "DOCTORATE";
export type DocumentType =
  | "APPLICATION_LETTER"
  | "PDS"
  | "PDS_EXCEL"
  | "IPCR"
  | "ELIGIBILITY_PROOF"
  | "LD_PROOF"
  | "TRANSCRIPT_OF_RECORDS"
  | "DIPLOMA"
  | "PQE_NOTICE"
  | "DESIGNATION_ORDER"
  | "AWARD_PROOF"
  | "COMPLIANCE_PROOF"
  | "OTHER";

export interface LdIntervention {
  id: string;
  title: string;
  dateAttended: string;
  numberOfHours: number;
  sponsoringAgency: string;
}

export interface Award {
  id: string;
  title: string;
  dateAwarded: string;
  issuingBody: string;
}

export interface ApplicantDocument {
  id: string;
  type: DocumentType;
  fileName: string;
  uploadedAt: string;
  ldInterventionId: string | null;
  awardId: string | null;
  complianceItemId: string | null;
}

export type ComplianceItemStatus = "PENDING" | "VERIFIED" | "REJECTED";
export type ComplianceSubmissionType = "SOFTCOPY" | "HARDCOPY" | "BOTH";

export interface ApplicationComplianceItem {
  id: string;
  status: ComplianceItemStatus;
  submissionType: ComplianceSubmissionType;
  remarks: string | null;
  requirement: { id: string; name: string; description: string | null };
  documents: ApplicantDocument[];
}

export interface ApplicantProfile {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  dateOfBirth: string;
  sex: "MALE" | "FEMALE";
  civilStatus: "SINGLE" | "MARRIED" | "WIDOWED" | "SEPARATED";
  address: string;
  contactNumber: string;
  hasEligibility: boolean;
  eligibilityType: EligibilityType;
  eligibilityValidated: boolean;
  educationLevel: EducationLevel;
  yearsOfExperience: number;
  registrationCompletedAt: string | null;
  ldInterventions: LdIntervention[];
  awards: Award[];
  documents?: ApplicantDocument[];
}

export interface DemographicProfileInput {
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  dateOfBirth: string;
  sex: "MALE" | "FEMALE";
  civilStatus: "SINGLE" | "MARRIED" | "WIDOWED" | "SEPARATED";
  address: string;
  contactNumber: string;
  hasEligibility: boolean;
  eligibilityType: EligibilityType;
  educationLevel: EducationLevel;
  yearsOfExperience: number;
}
