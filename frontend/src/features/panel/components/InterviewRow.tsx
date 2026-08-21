import { useState, type FormEvent } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { FieldError } from "@/shared/components/FieldError";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { getFieldErrors } from "@/shared/utils/apiErrors";
import type { Category, InterviewQueueApplication, PanelEvaluation } from "@/features/admin/types";
// Reused as-is from the admin feature: the panel role already depends on
// admin/types.ts and admin/api/categoriesApi.ts for shared rubric data, so
// this follows the same established cross-feature reuse rather than
// forking a second copy of a generic, read-only documents modal.
import { ApplicantDocumentsModal } from "@/features/admin/components/ApplicantDocumentsModal";
import { submitEvaluation } from "../api/panelEvaluationsApi";

interface Props {
  application: InterviewQueueApplication;
  categories: Category[];
  onSubmitted: (applicationId: string, evaluation: PanelEvaluation) => void;
}

export function InterviewRow({ application, categories, onSubmitted }: Props) {
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const ownEvaluation = application.panelEvaluations[0] ?? null;
  const canScore = application.examinationScore !== null;
  const [scores, setScores] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const category of categories) {
      for (const criterion of category.criteria) {
        const existing = ownEvaluation?.scores.find((s) => s.criterionId === criterion.id);
        initial[criterion.id] = existing ? String(existing.score) : "";
      }
    }
    return initial;
  });
  const [remarks, setRemarks] = useState(ownEvaluation?.remarks ?? "");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const nextFieldErrors: Record<string, string> = {};
    const parsedScores: { criterionId: string; score: number }[] = [];
    for (const category of categories) {
      for (const criterion of category.criteria) {
        const raw = scores[criterion.id] ?? "";
        const parsed = Number(raw);
        if (raw === "" || !Number.isInteger(parsed) || parsed < 0 || parsed > criterion.maxScore) {
          nextFieldErrors[criterion.id] = `Enter a whole number from 0 to ${criterion.maxScore}.`;
        } else {
          parsedScores.push({ criterionId: criterion.id, score: parsed });
        }
      }
    }
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError("Please fix the highlighted field(s) before continuing.");
      return;
    }

    setSubmitting(true);
    try {
      const updated = await submitEvaluation(application.id, {
        scores: parsedScores,
        ...(remarks ? { remarks } : {}),
      });
      onSubmitted(application.id, updated);
      toast.success(`Scores saved for ${application.applicant.firstName} ${application.applicant.lastName}.`);
      setExpanded(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(getFieldErrors(err));
      } else {
        setError("Failed to save scores");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <tr>
        <td>
          {application.applicant.firstName} {application.applicant.lastName}
        </td>
        <td>
          {application.jobPosting.title}
          {application.otherApplications.length > 0 && (
            <p className="field-hint">
              This score will also count for: {application.otherApplications.map((other) => other.jobPostingTitle).join(", ")}
            </p>
          )}
        </td>
        <td>{new Date(application.submittedAt).toLocaleDateString()}</td>
        <td>{application.examinationScore ?? "-"}</td>
        <td>
          <span className={`badge ${ownEvaluation ? "open" : "pending"}`}>{ownEvaluation ? "Scored" : "Pending"}</span>
        </td>
        <td>
          <div className="data-table-actions data-table-actions--uniform">
            <button type="button" className="secondary" onClick={() => setShowDocuments(true)}>
              View PDS
            </button>
            <button
              type="button"
              className="secondary"
              disabled={!canScore}
              title={canScore ? undefined : "No PQE exam score has been recorded for this applicant yet"}
              onClick={() => setExpanded((prev) => !prev)}
            >
              {expanded ? "Cancel" : ownEvaluation ? "Update scores" : "Score"}
            </button>
          </div>
        </td>
      </tr>
      {!canScore && (
        <tr>
          <td colSpan={6}>
            <p className="field-hint">No PQE exam score has been recorded for this applicant yet. Scoring is locked until it is.</p>
          </td>
        </tr>
      )}
      {expanded && (
        <tr>
          <td colSpan={6}>
            <ErrorBanner message={error} />
            <form onSubmit={handleSubmit} className="field-grid" noValidate>
              {categories.map((category) => (
                <div key={category.id} className="card-inset">
                  <strong>
                    {category.name}: {category.weightPercent}% of overall evaluation (raw scoring 0-{category.maxScore})
                  </strong>
                  {category.criteria.length === 0 && (
                    <p className="field-hint">No criteria/questions configured for this category yet.</p>
                  )}
                  {category.criteria.map((criterion) => (
                    <div
                      key={criterion.id}
                      className={fieldErrors[criterion.id] ? "field has-error" : "field"}
                      style={{ marginTop: "0.5rem" }}
                    >
                      <label htmlFor={`score-${application.id}-${criterion.id}`} className="required">
                        {criterion.name} (0-{criterion.maxScore})
                      </label>
                      <input
                        id={`score-${application.id}-${criterion.id}`}
                        type="number"
                        min={0}
                        max={criterion.maxScore}
                        required
                        value={scores[criterion.id] ?? ""}
                        onChange={(e) => setScores((prev) => ({ ...prev, [criterion.id]: e.target.value }))}
                      />
                      <FieldError message={fieldErrors[criterion.id]} />
                    </div>
                  ))}
                </div>
              ))}
              <div className="field">
                <label htmlFor={`remarks-${application.id}`}>Remarks (optional)</label>
                <textarea
                  id={`remarks-${application.id}`}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>
              <div className="field" style={{ alignSelf: "end" }}>
                <button type="submit" disabled={submitting}>
                  {submitting && <Spinner size="sm" onDark />}
                  {submitting ? "Saving..." : "Save scores"}
                </button>
              </div>
            </form>
          </td>
        </tr>
      )}
      {showDocuments && (
        <ApplicantDocumentsModal
          applicantId={application.applicant.id}
          applicantName={`${application.applicant.firstName} ${application.applicant.lastName}`}
          onClose={() => setShowDocuments(false)}
        />
      )}
    </>
  );
}
