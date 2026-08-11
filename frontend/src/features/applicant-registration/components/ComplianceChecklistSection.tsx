import { useEffect, useState } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { listComplianceItems } from "../api/applicationsApi";
import { removeDocument, uploadDocument } from "../api/documentsApi";
import type { ApplicationComplianceItem } from "../types";

interface Props {
  applicationId: string;
  // Only while the application is FOR_COMPLIANCE - once it moves to
  // Oath-Taking/Hired this renders the same checklist read-only, mirroring
  // how the interview-schedule block above stays visible after the fact.
  canUpload: boolean;
}

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

function statusLabel(status: ApplicationComplianceItem["status"]): string {
  if (status === "VERIFIED") return "Verified";
  if (status === "REJECTED") return "Rejected - re-upload needed";
  return "Pending";
}

/**
 * Mirrors LdInterventionSection's per-row upload/remove-proof mechanics, but
 * without the add/remove-*item* half - the checklist itself comes from the
 * admin-managed ComplianceRequirement catalog snapshotted onto this
 * application, not something the applicant adds to.
 */
export function ComplianceChecklistSection({ applicationId, canUpload }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<ApplicationComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingForItemId, setUploadingForItemId] = useState<string | null>(null);
  const [pendingRemoveProofId, setPendingRemoveProofId] = useState<string | null>(null);

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

  async function handleUpload(item: ApplicationComplianceItem, file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setError("File is too large — the maximum size is 5MB.");
      return;
    }
    setUploadingForItemId(item.id);
    try {
      const uploaded = await uploadDocument(file, "COMPLIANCE_PROOF", undefined, undefined, undefined, item.id);
      setItems((prev) =>
        prev.map((existing) => (existing.id === item.id ? { ...existing, documents: [uploaded] } : existing)),
      );
      toast.success("Proof uploaded.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to upload proof");
    } finally {
      setUploadingForItemId(null);
    }
  }

  async function handleRemoveProof() {
    if (!pendingRemoveProofId) return;
    setError(null);
    try {
      await removeDocument(pendingRemoveProofId);
      setItems((prev) =>
        prev.map((item) => ({ ...item, documents: item.documents.filter((doc) => doc.id !== pendingRemoveProofId) })),
      );
      toast.success("Proof removed.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove proof");
    } finally {
      setPendingRemoveProofId(null);
    }
  }

  if (loading) return <LoadingBlock label="Loading compliance requirements..." />;
  if (items.length === 0) return null;

  return (
    <div className="card-inset">
      <p className="field-hint">Compliance to Requirements checklist:</p>
      <ErrorBanner message={error} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Requirement</th>
              <th>Status</th>
              <th>Proof</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const proof = item.documents[0] ?? null;
              return (
                <tr key={item.id}>
                  <td>
                    {item.requirement.name}
                    {item.requirement.description && <p className="field-hint">{item.requirement.description}</p>}
                  </td>
                  <td>
                    <span className={`badge ${item.status.toLowerCase()}`}>{statusLabel(item.status)}</span>
                    {item.status === "REJECTED" && item.remarks && <p className="field-hint">{item.remarks}</p>}
                  </td>
                  <td>
                    {proof ? (
                      <div className="proof-item">
                        <span>{proof.fileName}</span>
                        {canUpload && item.status !== "VERIFIED" && (
                          <button type="button" className="danger" onClick={() => setPendingRemoveProofId(proof.id)}>
                            Remove
                          </button>
                        )}
                      </div>
                    ) : canUpload ? (
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        disabled={uploadingForItemId === item.id}
                        onChange={(e) => handleUpload(item, e.target.files?.[0])}
                      />
                    ) : (
                      <span className="field-hint">Not submitted</span>
                    )}
                    {uploadingForItemId === item.id && <Spinner size="sm" />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={pendingRemoveProofId !== null}
        title="Remove this proof file?"
        description="This file will be permanently deleted. You can upload a new one afterward."
        confirmLabel="Remove"
        onConfirm={handleRemoveProof}
        onCancel={() => setPendingRemoveProofId(null)}
      />
    </div>
  );
}
