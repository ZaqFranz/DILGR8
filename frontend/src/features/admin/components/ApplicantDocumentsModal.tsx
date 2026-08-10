import { useEffect, useState } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { Modal } from "@/shared/components/Modal";
import { Pagination } from "@/shared/components/Pagination";
import { Spinner } from "@/shared/components/Spinner";
import { usePagination } from "@/shared/utils/usePagination";
import { fetchDocumentFileUrl, listApplicantDocuments } from "../api/adminDocumentsApi";
import type { AdminDocument } from "../types";
import type { DocumentType } from "@/features/applicant-registration/types";

// Mirrors DocumentsSection.tsx's own copy - necessarily duplicated (no
// shared package between features for this), same as ELIGIBILITY_LABELS
// and SINGLE_INSTANCE_TYPES elsewhere in this app.
const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  APPLICATION_LETTER: "Application Letter",
  PDS: "Personal Data Sheet (PDS) — PDF copy",
  PDS_EXCEL: "Personal Data Sheet (PDS) — Excel (CS Form 212) copy",
  IPCR: "Performance Rating (Last Rating Period)",
  ELIGIBILITY_PROOF: "Certificate of Eligibility / Rating / License",
  LD_PROOF: "Learning & Development Proof",
  TRANSCRIPT_OF_RECORDS: "Transcript of Records",
  DIPLOMA: "Diploma",
  PQE_NOTICE: "Notice of Passing PQE Result",
  DESIGNATION_ORDER: "Proof of Designation",
  AWARD_PROOF: "Proof of Award(s)",
  OTHER: "Other",
};

// XLS/XLSX can't be rendered inline by the browser - opening the object URL
// in a new tab would just prompt a generic "how do you want to open this"
// dialog at best, so those types get an actual download instead.
const INLINE_VIEWABLE_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  applicantId: string;
  applicantName: string;
  onClose: () => void;
}

export function ApplicantDocumentsModal({ applicantId, applicantName, onClose }: Props) {
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const pagination = usePagination(documents, 10);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listApplicantDocuments(applicantId)
      .then((docs) => {
        if (!cancelled) setDocuments(docs);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load documents");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicantId]);

  async function handleView(doc: AdminDocument) {
    setError(null);
    setViewingId(doc.id);
    try {
      const url = await fetchDocumentFileUrl(doc.id);
      if (INLINE_VIEWABLE_MIME_TYPES.has(doc.mimeType)) {
        window.open(url, "_blank", "noopener,noreferrer");
        // The opened tab loads the blob independently of this object URL
        // reference, so it's safe to revoke shortly after - no need to keep
        // it alive for the lifetime of that tab.
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = doc.fileName;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to open document");
    } finally {
      setViewingId(null);
    }
  }

  return (
    <Modal
      open
      wide
      title={`Documents — ${applicantName}`}
      onClose={onClose}
      footer={
        <button type="button" className="secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      <ErrorBanner message={error} />
      {loading && (
        <p className="muted">
          <Spinner size="sm" /> Loading documents...
        </p>
      )}
      {!loading && documents.length === 0 && <p>This applicant hasn&apos;t uploaded any documents yet.</p>}
      {!loading && documents.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>File</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pagination.pageItems.map((doc) => (
                <tr key={doc.id}>
                  <td>{DOCUMENT_TYPE_LABELS[doc.type]}</td>
                  <td>{doc.fileName}</td>
                  <td>{formatFileSize(doc.fileSizeBytes)}</td>
                  <td>{new Date(doc.uploadedAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      type="button"
                      className="secondary"
                      disabled={viewingId === doc.id}
                      onClick={() => handleView(doc)}
                    >
                      {viewingId === doc.id && <Spinner size="sm" />}
                      {viewingId === doc.id
                        ? "Opening..."
                        : INLINE_VIEWABLE_MIME_TYPES.has(doc.mimeType)
                          ? "View"
                          : "Download"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            pageSize={10}
            onPageChange={pagination.setPage}
          />
        </div>
      )}
    </Modal>
  );
}
