import { useState } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { Modal } from "@/shared/components/Modal";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { markHired } from "../api/adminApplicationsApi";
import type { AdminApplication } from "../types";

interface Props {
  applicantName: string;
  // The applicant's applications currently at FOR_OATH_TAKING - always 2+
  // (ApplicantGroupSummaryRow only renders this modal when there's an
  // actual choice to make). Listed neutrally, no default selection and no
  // highest-Salary-Grade suggestion - client requirement: "this is manual
  // from Admin no need to assign the highest SG automatically".
  candidates: AdminApplication[];
  onClose: () => void;
  onAssigned: () => void | Promise<void>;
}

export function AssignPositionModal({ applicantName, candidates, onClose, onAssigned }: Props) {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!selectedId) return;
    const chosen = candidates.find((application) => application.id === selectedId);
    setError(null);
    setSubmitting(true);
    try {
      await markHired(selectedId);
      toast.success(`${applicantName} was assigned to "${chosen?.jobPosting.title}" - their other applications were auto-closed.`);
      await onAssigned();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to assign position");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      title={`Assign Position: ${applicantName}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" disabled={!selectedId || submitting} onClick={handleConfirm}>
            {submitting && <Spinner size="sm" onDark />}
            {submitting ? "Assigning..." : "Confirm Assignment"}
          </button>
        </>
      }
    >
      <ErrorBanner message={error} />
      <p className="field-hint">
        {applicantName} has reached Oath-Taking on {candidates.length} postings. Pick which one to actually assign
        them to - the others will be automatically marked Not Selected and freed up for other applicants.
      </p>
      <div className="checkbox-group" style={{ flexDirection: "column" }}>
        {candidates.map((application) => (
          <label key={application.id} className="checkbox-option">
            <input
              type="radio"
              name="assign-position"
              value={application.id}
              checked={selectedId === application.id}
              onChange={() => setSelectedId(application.id)}
            />
            <span>
              <strong>{application.jobPosting.title}</strong> - Salary Grade {application.jobPosting.salaryGrade},{" "}
              {application.jobPosting.publication}
            </span>
          </label>
        ))}
      </div>
    </Modal>
  );
}
