import { useEffect, useState } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { Modal } from "@/shared/components/Modal";
import { Spinner } from "@/shared/components/Spinner";
import { fetchDocumentFileUrl } from "../api/adminDocumentsApi";
import { listComplianceItems, reviewComplianceItem } from "../api/adminApplicationsApi";
import type { ApplicationComplianceItem } from "../types";

interface Props {
  applicationId: string;
  applicantName: string;
  onClose: () => void;
}

/**
 * Structurally mirrors ApplicantDocumentsModal (same view/download-by-mime
 * mechanics, via the same fully generic fetchDocumentFileUrl) but is its own
 * component rather than a generalization of that one - this modal also
 * drives the Verify/Reject decision per requirement, which the read-only
 * documents viewer has no concept of.
 */
export function ComplianceReviewModal({ applicationId, applicantName, onClose }: Props) {
  const [items, setItems] = useState<ApplicationComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [remarksByItem, setRemarksByItem] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    listComplianceItems(applicationId)
      .then((loaded) => {
        if (!cancelled) setItems(loaded);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load compliance requirements");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  async function handleView(documentId: string) {
    setError(null);
    setViewingId(documentId);
    try {
      const url = await fetchDocumentFileUrl(documentId);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to open document");
    } finally {
      setViewingId(null);
    }
  }

  async function handleReview(item: ApplicationComplianceItem, status: "VERIFIED" | "REJECTED") {
    setError(null);
    setReviewingId(item.id);
    try {
      const remarks = remarksByItem[item.id];
      const updated = await reviewComplianceItem(applicationId, item.id, {
        status,
        ...(remarks ? { remarks } : {}),
      });
      setItems((prev) => prev.map((existing) => (existing.id === item.id ? updated : existing)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to review requirement");
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <Modal
      open
      wide
      title={`Compliance Requirements — ${applicantName}`}
      onClose={onClose}
      footer={
        <button type="button" className="secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      <ErrorBanner message={error} />
      {loading && <LoadingBlock label="Loading compliance requirements..." />}
      {!loading && items.length === 0 && (
        <p>No active compliance requirements were configured when this applicant moved to Compliance.</p>
      )}
      {!loading && items.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Requirement</th>
                <th>Status</th>
                <th>Proof</th>
                <th>Remarks</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const document = item.documents[0] ?? null;
                return (
                  <tr key={item.id}>
                    <td>
                      {item.requirement.name}
                      {item.requirement.description && <p className="field-hint">{item.requirement.description}</p>}
                    </td>
                    <td>
                      <span className={`badge ${item.status.toLowerCase()}`}>{item.status}</span>
                    </td>
                    <td>
                      {document ? (
                        <button
                          type="button"
                          className="secondary"
                          disabled={viewingId === document.id}
                          onClick={() => handleView(document.id)}
                        >
                          {viewingId === document.id && <Spinner size="sm" />}
                          {viewingId === document.id ? "Opening..." : "View Proof"}
                        </button>
                      ) : (
                        <span className="field-hint">Not submitted yet</span>
                      )}
                    </td>
                    <td>
                      {document ? (
                        <input
                          aria-label={`Remarks for ${item.requirement.name}`}
                          placeholder="Optional remarks"
                          value={remarksByItem[item.id] ?? item.remarks ?? ""}
                          onChange={(e) => setRemarksByItem((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {document && (
                        <div className="data-table-actions">
                          <button
                            type="button"
                            disabled={reviewingId === item.id}
                            onClick={() => handleReview(item, "VERIFIED")}
                          >
                            {reviewingId === item.id && <Spinner size="sm" onDark />}
                            Verify
                          </button>
                          <button
                            type="button"
                            className="danger"
                            disabled={reviewingId === item.id}
                            onClick={() => handleReview(item, "REJECTED")}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
