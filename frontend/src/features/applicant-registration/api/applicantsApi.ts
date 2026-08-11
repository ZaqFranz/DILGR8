import { apiRequest, ApiError } from "@/shared/api/apiClient";
import type { ApplicantProfile, Award, DemographicProfileInput, LdIntervention } from "../types";

export async function getMyProfile(): Promise<ApplicantProfile | null> {
  try {
    return await apiRequest<ApplicantProfile>("/applicants/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

export function createProfile(input: DemographicProfileInput): Promise<ApplicantProfile> {
  return apiRequest<ApplicantProfile>("/applicants/me", { method: "POST", body: input });
}

export function updateProfile(input: Partial<DemographicProfileInput>): Promise<ApplicantProfile> {
  return apiRequest<ApplicantProfile>("/applicants/me", { method: "PATCH", body: input });
}

export function completeRegistration(): Promise<ApplicantProfile> {
  return apiRequest<ApplicantProfile>("/applicants/me/complete-registration", { method: "POST" });
}

export function addLdIntervention(input: {
  title: string;
  dateAttended: string;
  numberOfHours: number;
  sponsoringAgency: string;
}): Promise<LdIntervention> {
  return apiRequest<LdIntervention>("/applicants/me/ld-interventions", { method: "POST", body: input });
}

export function removeLdIntervention(id: string): Promise<void> {
  return apiRequest<void>(`/applicants/me/ld-interventions/${id}`, { method: "DELETE" });
}

export function addAward(input: { title: string; dateAwarded: string; issuingBody: string }): Promise<Award> {
  return apiRequest<Award>("/applicants/me/awards", { method: "POST", body: input });
}

export function removeAward(id: string): Promise<void> {
  return apiRequest<void>(`/applicants/me/awards/${id}`, { method: "DELETE" });
}
