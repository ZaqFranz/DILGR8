import { useState, type FormEvent } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { FieldError } from "@/shared/components/FieldError";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { getFieldErrors } from "@/shared/utils/apiErrors";
import { evaluateApplication, scheduleInterview } from "../api/adminApplicationsApi";
import type { AdminApplication, EvaluationDecision, TabulationRow } from "../types";

interface Props {
  application: AdminApplication;
  onEvaluated: (updated: AdminApplication) => void;
  onScheduled: (updated: AdminApplication) => void;
  tabulation: TabulationRow | null;
  panelists: { id: string; email: string }[];
}

const SCHEDULABLE_STATUSES = new Set(["SUBMITTED", "UNDER_SIFTING"]);

export function EvaluationRow({ application, onEvaluated, onScheduled, tabulation, panelists }: Props) {
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [score, setScore] = useState(application.evaluationScore?.toString() ?? "");
  const [decision, setDecision] = useState<EvaluationDecision>(
    application.status === "NOT_QUALIFIED" ? "NOT_QUALIFIED" : "QUALIFIED",
  );
  const [remarks, setRemarks] = useState(application.evaluationRemarks ?? "");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    const parsedScore = Number(score);
    if (!Number.isInteger(parsedScore) || parsedScore < 0 || parsedScore > 100) {
      setFieldErrors({ score: "Score must be a whole number from 0 to 100." });
      setError("Please fix the highlighted field before continuing.");
      return;
    }
    setSubmitting(true);
    try {
      const updated = await evaluateApplication(application.id, {
        score: parsedScore,
        decision,
        ...(remarks ? { remarks } : {}),
      });
      onEvaluated(updated);
      toast.success(
        `Evaluation saved for ${application.applicant.firstName} ${application.applicant.lastName} — ${
          decision === "QUALIFIED" ? "Qualified" : "Not qualified"
        }.`,
      );
      setExpanded(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(getFieldErrors(err));
      } else {
        setError("Failed to save evaluation");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleScheduleInterview() {
    setError(null);
    setScheduling(true);
    try {
      const updated = await scheduleInterview(application.id);
      onScheduled(updated);
      toast.success(`${application.applicant.firstName} ${application.applicant.lastName} was scheduled for interview.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to schedule interview");
    } finally {
      setScheduling(false);
    }
  }

  const incompleteScoring = tabulation !== null && tabulation.panelistsSubmitted < tabulation.panelistsAssigned;

  return (
    <>
      <tr>
        <td>
          {application.applicant.firstName} {application.applicant.lastName}
        </td>
        <td>{application.applicant.user.email}</td>
        <td>{new Date(application.submittedAt).toLocaleDateString()}</td>
        <td>
          <span className={`badge ${application.status.toLowerCase()}`}>{application.status}</span>
        </td>
        <td>{application.evaluationScore ?? "-"}</td>
        <td>{tabulation?.average !== undefined && tabulation.average !== null ? tabulation.average.toFixed(1) : "-"}</td>
        <td>{tabulation?.rank ?? "-"}</td>
        <td>
          <div className="data-table-actions">
            {SCHEDULABLE_STATUSES.has(application.status) && (
              <button type="button" className="secondary" disabled={scheduling} onClick={handleScheduleInterview}>
                {scheduling ? "Scheduling..." : "Schedule Interview"}
              </button>
            )}
            <button type="button" className="secondary" onClick={() => setExpanded((prev) => !prev)}>
              {expanded ? "Cancel" : application.evaluatedAt ? "Re-evaluate" : "Evaluate"}
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8}>
            <ErrorBanner message={error} />
            {tabulation && tabulation.panelistsAssigned > 0 && (
              <div className="card-inset">
                <p className="field-hint">
                  Panel scores ({tabulation.panelistsSubmitted}/{tabulation.panelistsAssigned} submitted):
                </p>
                <ul className="panel-score-list">
                  {panelists.map((panelist) => (
                    <li key={panelist.id}>
                      {panelist.email}: {tabulation.perPanelist[panelist.id] ?? "not yet scored"}
                    </li>
                  ))}
                </ul>
                {incompleteScoring && (
                  <p className="field-warning">
                    {tabulation.panelistsAssigned - tabulation.panelistsSubmitted} of {tabulation.panelistsAssigned}{" "}
                    panelist(s) haven&apos;t submitted scores yet.
                  </p>
                )}
              </div>
            )}
            <form onSubmit={handleSubmit} className="field-grid" noValidate>
              <div className={fieldErrors.score ? "field has-error" : "field"}>
                <label htmlFor={`score-${application.id}`} className="required">
                  Score (0-100)
                </label>
                <input
                  id={`score-${application.id}`}
                  type="number"
                  min={0}
                  max={100}
                  required
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                />
                <FieldError message={fieldErrors.score} />
              </div>
              <div className="field">
                <label htmlFor={`decision-${application.id}`}>Decision</label>
                <select
                  id={`decision-${application.id}`}
                  value={decision}
                  onChange={(e) => setDecision(e.target.value as EvaluationDecision)}
                >
                  <option value="QUALIFIED">Qualified</option>
                  <option value="NOT_QUALIFIED">Not qualified</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor={`remarks-${application.id}`}>Remarks</label>
                <textarea
                  id={`remarks-${application.id}`}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>
              <div className="field" style={{ alignSelf: "end" }}>
                <button type="submit" disabled={submitting}>
                  {submitting && <Spinner size="sm" onDark />}
                  {submitting ? "Saving..." : "Save evaluation"}
                </button>
              </div>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}
