import { apiRequest } from "@/shared/api/apiClient";
import type { ComplianceRequirement, CreateComplianceRequirementInput, UpdateComplianceRequirementInput } from "../types";

export function listComplianceRequirements(): Promise<ComplianceRequirement[]> {
  return apiRequest<ComplianceRequirement[]>("/compliance-requirements");
}

export function createComplianceRequirement(input: CreateComplianceRequirementInput): Promise<ComplianceRequirement> {
  return apiRequest<ComplianceRequirement>("/compliance-requirements", { method: "POST", body: input });
}

export function updateComplianceRequirement(
  id: string,
  input: UpdateComplianceRequirementInput,
): Promise<ComplianceRequirement> {
  return apiRequest<ComplianceRequirement>(`/compliance-requirements/${id}`, { method: "PATCH", body: input });
}

export function deleteComplianceRequirement(id: string): Promise<void> {
  return apiRequest<void>(`/compliance-requirements/${id}`, { method: "DELETE" });
}
