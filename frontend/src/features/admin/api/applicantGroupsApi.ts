import { apiRequest } from "@/shared/api/apiClient";
import type { ApplicantGroup, CreateApplicantGroupInput, UpdateApplicantGroupInput } from "../types";

export function listApplicantGroups(): Promise<ApplicantGroup[]> {
  return apiRequest<ApplicantGroup[]>("/applicant-groups");
}

export function createApplicantGroup(input: CreateApplicantGroupInput): Promise<ApplicantGroup> {
  return apiRequest<ApplicantGroup>("/applicant-groups", { method: "POST", body: input });
}

export function updateApplicantGroup(id: string, input: UpdateApplicantGroupInput): Promise<ApplicantGroup> {
  return apiRequest<ApplicantGroup>(`/applicant-groups/${id}`, { method: "PATCH", body: input });
}

export function deleteApplicantGroup(id: string): Promise<void> {
  return apiRequest<void>(`/applicant-groups/${id}`, { method: "DELETE" });
}
