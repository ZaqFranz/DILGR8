import { useEffect, useState } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { Modal } from "@/shared/components/Modal";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { fetchDocumentFileUrl } from "../api/adminDocumentsApi";
import {
  addComplianceItem,
  listComplianceItems,
  reviewComplianceItem,
  setComplianceItemSubmissionType,
} from "../api/adminApplicationsApi";
import { listComplianceRequirements } from "../api/complianceRequirementsApi";
import type { ApplicationComplianceItem, ComplianceRequirement, ComplianceSubmissionType } from "../types";

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
  const toast = useToast();
  const [items, setItems] = useState<ApplicationComplianceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [remarksByItem, setRemarksByItem] = useState<Record<string, string>>({});
  const [catalog, setCatalog] = useState<ComplianceRequirement[]>([]);
  const [selectedRequirementId, setSelectedRequirementId] = useState("");
  const [newSubmissionType, setNewSubmissionType] = useState<ComplianceSubmissionType>("SOFTCOPY");
  const [adding, setAdding] = useState(false);
  const [updatingTypeId, setUpdatingTypeId] = useState<string | null>(null);

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

  // Populates the "Add a requirement" picker below - lets the admin attach
  // a requirement from the catalog directly to this applicant instead of
  // only ever relying on the automatic snapshot taken when they moved to
  // Compliance (which yields nothing to review if the catalog was empty or
  // missing the right requirement at that moment).
  useEffect(() => {
    let cancelled = false;
    listComplianceRequirements()
      .then((loaded) => {
        if (!cancelled) setCatalog(loaded);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const availableRequirements = catalog.filter(
    (requirement) => !items.some((item) => item.requirementId === requirement.id),
  );

  async function handleAddRequirement() {
    if (!selectedRequirementId) return;
    setError(null);
    setAdding(true);
    try {
      const created = await addComplianceItem(applicationId, {
        requirementId: selectedRequirementId,
        submissionType: newSubmissionType,
      });
      setItems((prev) => [...prev, created]);
      setSelectedRequirementId("");
      setNewSubmissionType("SOFTCOPY");
      toast.success(`Added "${created.requirement.name}" to ${applicantName}'s compliance checklist.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add compliance requirement");
    } finally {
      setAdding(false);
    }
  }

  async function handleSubmissionTypeChange(item: ApplicationComplianceItem, submissionType: ComplianceSubmissionType) {
    setError(null);
    setUpdatingTypeId(item.id);
    try {
      const updated = await setComplianceItemSubmissionType(applicationId, item.id, submissionType);
      setItems((prev) => prev.map((existing) => (existing.id === item.id ? updated : existing)));
      toast.success(
        `"${item.requirement.name}" is now expected as ${submissionType === "HARDCOPY" ? "Hardcopy (physical)" : "Softcopy (online)"}.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update submission type");
    } finally {
      setUpdatingTypeId(null);
    }
  }

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
      toast.success(
        `Marked "${item.requirement.name}" ${status === "VERIFIED" ? "Verified" : "Rejected"} for ${applicantName}.`,
      );
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
        <p>No compliance requirements are on this applicant's checklist yet. Add one below and mark it Verified once satisfied.</p>
      )}
      {!loading && availableRequirements.length > 0 && (
        <div className="field-grid" style={{ marginBottom: "1rem" }}>
          <div className="field">
            <label htmlFor="add-compliance-requirement">Add a requirement to this applicant's checklist</label>
            <select
              id="add-compliance-requirement"
              value={selectedRequirementId}
              onChange={(e) => setSelectedRequirementId(e.target.value)}
            >
              <option value="">Select a requirement…</option>
              {availableRequirements.map((requirement) => (
                <option key={requirement.id} value={requirement.id}>
                  {requirement.name}
                  {!requirement.isActive ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="add-compliance-submission-type">Expected submission</label>
            <select
              id="add-compliance-submission-type"
              value={newSubmissionType}
              onChange={(e) => setNewSubmissionType(e.target.value as ComplianceSubmissionType)}
            >
              <option value="SOFTCOPY">Softcopy (online upload)</option>
              <option value="HARDCOPY">Hardcopy (physical)</option>
            </select>
          </div>
          <div className="field" style={{ alignSelf: "end" }}>
            <button
              type="button"
              className="secondary"
              disabled={!selectedRequirementId || adding}
              onClick={handleAddRequirement}
            >
              {adding && <Spinner size="sm" />}
              {adding ? "Adding..." : "Add requirement"}
            </button>
          </div>
        </div>
      )}
      {!loading && items.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Requirement</th>
                <th>Status</th>
                <th>Submission</th>
                <th>Proof</th>
                <th>Remarks</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const document = item.documents[0] ?? null;
                const isHardcopy = item.submissionType === "HARDCOPY";
                // A softcopy item needs its online proof uploaded before it
                // can be Verified - a hardcopy item has no online proof to
                // wait on, so the admin's own review is the only gate.
                const canVerify = isHardcopy || document !== null;
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
                      <select
                        aria-label={`Expected submission for ${item.requirement.name}`}
                        value={item.submissionType}
                        disabled={updatingTypeId === item.id}
                        onChange={(e) => handleSubmissionTypeChange(item, e.target.value as ComplianceSubmissionType)}
                      >
                        <option value="SOFTCOPY">Softcopy (online)</option>
                        <option value="HARDCOPY">Hardcopy (physical)</option>
                      </select>
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
                      ) : isHardcopy ? (
                        <span className="field-hint">Hardcopy - no online copy expected</span>
                      ) : (
                        <span className="field-hint">Not submitted yet</span>
                      )}
                    </td>
                    <td>
                      <input
                        aria-label={`Remarks for ${item.requirement.name}`}
                        placeholder="Optional remarks"
                        value={remarksByItem[item.id] ?? item.remarks ?? ""}
                        onChange={(e) => setRemarksByItem((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      />
                    </td>
                    <td>
                      <div className="data-table-actions">
                        <button
                          type="button"
                          disabled={reviewingId === item.id || !canVerify}
                          title={canVerify ? undefined : "The applicant hasn't uploaded proof yet - mark it Hardcopy if it was submitted physically instead."}
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
