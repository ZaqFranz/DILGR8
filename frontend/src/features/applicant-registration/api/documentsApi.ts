import { apiRequest } from "@/shared/api/apiClient";
import type { ApplicantDocument, DocumentType } from "../types";

export function listMyDocuments(): Promise<ApplicantDocument[]> {
  return apiRequest<ApplicantDocument[]>("/applicants/me/documents");
}

export function uploadDocument(
  file: File,
  type: DocumentType,
  applicationId?: string,
  ldInterventionId?: string,
): Promise<ApplicantDocument> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);
  if (applicationId) {
    formData.append("applicationId", applicationId);
  }
  if (ldInterventionId) {
    formData.append("ldInterventionId", ldInterventionId);
  }
  return apiRequest<ApplicantDocument>("/applicants/me/documents", {
    method: "POST",
    body: formData,
    isFormData: true,
  });
}

export function removeDocument(id: string): Promise<void> {
  return apiRequest<void>(`/applicants/me/documents/${id}`, { method: "DELETE" });
}
