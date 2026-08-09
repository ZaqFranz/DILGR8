import { apiRequest, apiRequestBlob } from "@/shared/api/apiClient";
import type { AdminDocument } from "../types";

export function listApplicantDocuments(applicantId: string): Promise<AdminDocument[]> {
  return apiRequest<AdminDocument[]>(`/applicants/${applicantId}/documents`);
}

/** Fetches the document's file bytes and returns an object URL the caller is responsible for revoking (`URL.revokeObjectURL`) once done with it. */
export async function fetchDocumentFileUrl(documentId: string): Promise<string> {
  const blob = await apiRequestBlob(`/applicants/documents/${documentId}/file`);
  return URL.createObjectURL(blob);
}
