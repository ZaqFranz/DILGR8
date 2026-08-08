export type EligibilityType = "RA1080" | "CSC_PROFESSIONAL" | "CSC_SUBPROFESSIONAL" | "BARANGAY" | "NONE";
export type DocumentType = "ELIGIBILITY_PROOF" | "IPCR" | "DESIGNATION_ORDER" | "LD_PROOF" | "OTHER";

export interface WorkExperience {
  id: string;
  inclusiveFrom: string;
  inclusiveTo: string | null;
  positionDesignation: string;
  agency: string;
}

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
  registrationCompletedAt: string | null;
  workExperiences: WorkExperience[];
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
}
