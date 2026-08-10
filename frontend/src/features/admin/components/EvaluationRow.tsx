import { useState, type FormEvent } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { FieldError } from "@/shared/components/FieldError";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { getFieldErrors } from "@/shared/utils/apiErrors";
import { APPLICATION_STATUS_LABELS } from "@/shared/constants/applicationStatus";
import { scheduleInterview, setExaminationScore, siftApplication } from "../api/adminApplicationsApi";
import { ApplicantDocumentsModal } from "./ApplicantDocumentsModal";
import type { AdminApplication, EvaluationDecision, TabulationRow } from "../types";

interface Props {
  application: AdminApplication;
  onSifted: (updated: AdminApplication) => void;
  onScheduled: (updated: AdminApplication) => void;
  tabulation: TabulationRow | null;
  panelists: { id: string; email: string }[];
}

function canScheduleInterview(application: AdminApplication): boolean {
  return application.status === "QUALIFIED" && application.examinationScore !== null;
}

const emptyScheduleForm = { scheduledAt: "", scheduledEndAt: "", venue: "", attire: "", notes: "" };

export function EvaluationRow({ application, onSifted, onScheduled, tabulation, panelists }: Props) {
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [decision, setDecision] = useState<EvaluationDecision>("QUALIFIED");
  const [remarks, setRemarks] = useState("");
  const [scheduleForm, setScheduleForm] = useState(emptyScheduleForm);
  const [examScore, setExamScore] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [settingScore, setSettingScore] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);

  const isSiftable = application.status === "UNDER_SIFTING";
  const isSchedulable = canScheduleInterview(application);
  // Manual, single-application alternative to the "Import PQE Scores" Excel
  // upload above the table - same underlying score, just for admins who'd
  // rather key in one number than build a spreadsheet for it.
  const canEnterExamScore = application.status === "QUALIFIED" && application.examinationScore === null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const updated = await siftApplication(application.id, {
        decision,
        ...(remarks ? { remarks } : {}),
      });
      onSifted(updated);
      toast.success(
        `Sifting decision saved for ${application.applicant.firstName} ${application.applicant.lastName} — ${
          decision === "QUALIFIED" ? "Qualified" : "Not qualified"
        }.`,
      );
      setExpanded(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save sifting decision");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleScheduleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!scheduleForm.scheduledAt) {
      setFieldErrors({ scheduledAt: "From date/time is required." });
      return;
    }
    if (scheduleForm.scheduledEndAt && scheduleForm.scheduledEndAt < scheduleForm.scheduledAt) {
      setFieldErrors({ scheduledEndAt: "To date/time can't be earlier than From." });
      return;
    }
    if (!scheduleForm.venue.trim()) {
      setFieldErrors({ venue: "Venue is required." });
      return;
    }
    setScheduling(true);
    try {
      const updated = await scheduleInterview(application.id, {
        scheduledAt: scheduleForm.scheduledAt,
        ...(scheduleForm.scheduledEndAt ? { scheduledEndAt: scheduleForm.scheduledEndAt } : {}),
        venue: scheduleForm.venue,
        ...(scheduleForm.attire ? { attire: scheduleForm.attire } : {}),
        ...(scheduleForm.notes ? { notes: scheduleForm.notes } : {}),
      });
      onScheduled(updated);
      toast.success(`${application.applicant.firstName} ${application.applicant.lastName} was scheduled for evaluation.`);
      setScheduleForm(emptyScheduleForm);
      setExpanded(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(getFieldErrors(err));
      } else {
        setError("Failed to schedule evaluation");
      }
    } finally {
      setScheduling(false);
    }
  }

  async function handleSetScoreSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    const parsedScore = Number(examScore);
    if (examScore.trim() === "" || !Number.isInteger(parsedScore) || parsedScore < 0 || parsedScore > 100) {
      setFieldErrors({ score: "Enter a whole number from 0 to 100." });
      return;
    }
    setSettingScore(true);
    try {
      const updated = await setExaminationScore(application.id, parsedScore);
      // onSifted is really just "replace this row's application in the
      // parent's list" - identical to onScheduled below, reused here rather
      // than adding a third prop that would do the exact same thing.
      onSifted(updated);
      toast.success(
        `PQE score of ${parsedScore} recorded for ${application.applicant.firstName} ${application.applicant.lastName}.`,
      );
      setExamScore("");
      setExpanded(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(getFieldErrors(err));
      } else {
        setError("Failed to record PQE score");
      }
    } finally {
      setSettingScore(false);
    }
  }

  const incompleteScoring = tabulation !== null && tabulation.panelistsSubmitted < tabulation.panelistsAssigned;
  const hasDetails =
    isSiftable ||
    isSchedulable ||
    canEnterExamScore ||
    application.siftedAt !== null ||
    application.interviewScheduledAt !== null ||
    (tabulation !== null && tabulation.panelistsAssigned > 0);

  function toggleLabel(): string {
    if (expanded) return "Cancel";
    if (isSiftable) return "Sift";
    if (canEnterExamScore) return "Enter PQE Score";
    if (isSchedulable) return "Evaluate Applicant";
    return "Details";
  }

  return (
    <>
      <tr>
        <td>
          {application.applicant.firstName} {application.applicant.lastName}
        </td>
        <td>{application.applicant.user.email}</td>
        <td>{application.jobPosting.title}</td>
        <td>{new Date(application.submittedAt).toLocaleDateString()}</td>
        <td>
          <span className={`badge ${application.status.toLowerCase()}`}>
            {APPLICATION_STATUS_LABELS[application.status]}
          </span>
        </td>
        <td>{application.examinationScore ?? "-"}</td>
        <td>{tabulation?.average !== undefined && tabulation.average !== null ? tabulation.average.toFixed(1) : "-"}</td>
        <td>{tabulation?.rank ?? "-"}</td>
        <td>
          <div className="data-table-actions data-table-actions--uniform">
            <button type="button" className="secondary" onClick={() => setShowDocuments(true)}>
              View Documents
            </button>
            {hasDetails && (
              <button type="button" className="secondary" onClick={() => setExpanded((prev) => !prev)}>
                {toggleLabel()}
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9}>
            <ErrorBanner message={error} />
            {!isSiftable && application.siftedAt !== null && (
              <div className="card-inset">
                <p className="field-hint">
                  Sifted {new Date(application.siftedAt).toLocaleString()} — {application.status === "QUALIFIED" ? "Qualified" : "Not qualified"}
                </p>
                {application.siftingRemarks && <p>{application.siftingRemarks}</p>}
              </div>
            )}
            {application.interviewScheduledAt !== null && (
              <div className="card-inset">
                <p className="field-hint">Evaluation scheduled:</p>
                <ul>
                  {application.interviewScheduledEndAt !== null ? (
                    <>
                      <li>
                        <strong>Day 1:</strong> {new Date(application.interviewScheduledAt).toLocaleString()}
                      </li>
                      <li>
                        <strong>Day 2:</strong> {new Date(application.interviewScheduledEndAt).toLocaleString()}
                      </li>
                    </>
                  ) : (
                    <li>
                      <strong>When:</strong> {new Date(application.interviewScheduledAt).toLocaleString()}
                    </li>
                  )}
                  <li>
                    <strong>Where:</strong> {application.interviewVenue}
                  </li>
                  {application.interviewAttire && (
                    <li>
                      <strong>What to wear:</strong> {application.interviewAttire}
                    </li>
                  )}
                  {application.interviewNotes && (
                    <li>
                      <strong>Notes:</strong> {application.interviewNotes}
                    </li>
                  )}
                </ul>
              </div>
            )}
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
            {isSiftable && (
              <form onSubmit={handleSubmit} className="field-grid" noValidate>
                <div className="field">
                  <label htmlFor={`decision-${application.id}`}>Sifting decision</label>
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
                    {submitting ? "Saving..." : "Save sifting decision"}
                  </button>
                </div>
              </form>
            )}
            {canEnterExamScore && (
              <form onSubmit={handleSetScoreSubmit} className="field-grid" noValidate>
                <div className={fieldErrors.score ? "field has-error" : "field"}>
                  <label htmlFor={`exam-score-${application.id}`} className="required">
                    PQE score
                  </label>
                  <input
                    id={`exam-score-${application.id}`}
                    type="number"
                    min={0}
                    max={100}
                    required
                    placeholder="0–100"
                    value={examScore}
                    onChange={(e) => setExamScore(e.target.value)}
                  />
                  <FieldError message={fieldErrors.score} />
                </div>
                <div className="field" style={{ alignSelf: "end" }}>
                  <button type="submit" disabled={settingScore}>
                    {settingScore && <Spinner size="sm" onDark />}
                    {settingScore ? "Saving..." : "Save PQE score"}
                  </button>
                </div>
              </form>
            )}
            {isSchedulable && (
              <form onSubmit={handleScheduleSubmit} className="field-grid" noValidate>
                <div className={fieldErrors.scheduledAt ? "field has-error" : "field"}>
                  <label htmlFor={`scheduled-at-${application.id}`} className="required">
                    From
                  </label>
                  <input
                    id={`scheduled-at-${application.id}`}
                    type="datetime-local"
                    required
                    value={scheduleForm.scheduledAt}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledAt: e.target.value })}
                  />
                  <FieldError message={fieldErrors.scheduledAt} />
                </div>
                <div className={fieldErrors.scheduledEndAt ? "field has-error" : "field"}>
                  <label htmlFor={`scheduled-end-at-${application.id}`}>To (optional)</label>
                  <input
                    id={`scheduled-end-at-${application.id}`}
                    type="datetime-local"
                    value={scheduleForm.scheduledEndAt}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledEndAt: e.target.value })}
                  />
                  <FieldError message={fieldErrors.scheduledEndAt} />
                </div>
                <div className={fieldErrors.venue ? "field has-error" : "field"}>
                  <label htmlFor={`venue-${application.id}`} className="required">
                    Venue
                  </label>
                  <input
                    id={`venue-${application.id}`}
                    required
                    placeholder="e.g. DILG Regional Office, Conference Room B"
                    value={scheduleForm.venue}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, venue: e.target.value })}
                  />
                  <FieldError message={fieldErrors.venue} />
                </div>
                <div className="field">
                  <label htmlFor={`attire-${application.id}`}>What to wear (optional)</label>
                  <input
                    id={`attire-${application.id}`}
                    placeholder="e.g. Business attire"
                    value={scheduleForm.attire}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, attire: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`notes-${application.id}`}>Additional instructions (optional)</label>
                  <textarea
                    id={`notes-${application.id}`}
                    placeholder="e.g. Bring a valid ID and your original documents"
                    value={scheduleForm.notes}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                  />
                </div>
                <div className="field" style={{ alignSelf: "end" }}>
                  <button type="submit" disabled={scheduling}>
                    {scheduling && <Spinner size="sm" onDark />}
                    {scheduling ? "Saving..." : "Save evaluation schedule"}
                  </button>
                </div>
              </form>
            )}
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
