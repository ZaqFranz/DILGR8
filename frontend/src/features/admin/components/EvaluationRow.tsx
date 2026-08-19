import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { FieldError } from "@/shared/components/FieldError";
import { Modal } from "@/shared/components/Modal";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { getFieldErrors } from "@/shared/utils/apiErrors";
import { APPLICATION_STATUS_LABELS } from "@/shared/constants/applicationStatus";
import {
  listComplianceItems,
  markHired,
  moveToCompliance,
  rejectAfterCompliance,
  rejectAfterInterview,
  scheduleInterview,
  scheduleOathTaking,
  setExaminationScore,
  siftApplication,
} from "../api/adminApplicationsApi";
import { ApplicantDocumentsModal } from "./ApplicantDocumentsModal";
import { ComplianceReviewModal } from "./ComplianceReviewModal";
import type { AdminApplication, ApplicationComplianceItem, EvaluationDecision, TabulationRow } from "../types";

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
const emptyOathForm = { scheduledAt: "", venue: "", notes: "" };

export function EvaluationRow({ application, onSifted, onScheduled, tabulation, panelists }: Props) {
  const toast = useToast();
  const [showDetailsModal, setShowDetailsModal] = useState(false);
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
  const [movingToCompliance, setMovingToCompliance] = useState(false);
  const [complianceItems, setComplianceItems] = useState<ApplicationComplianceItem[] | null>(null);
  const [complianceRefreshToken, setComplianceRefreshToken] = useState(0);
  const [showComplianceReview, setShowComplianceReview] = useState(false);
  const [oathForm, setOathForm] = useState(emptyOathForm);
  const [schedulingOath, setSchedulingOath] = useState(false);
  const [showMarkHiredConfirm, setShowMarkHiredConfirm] = useState(false);
  const [showNotSelectedConfirm, setShowNotSelectedConfirm] = useState(false);
  const [notSelectedRemarks, setNotSelectedRemarks] = useState("");
  const [showDisqualifyConfirm, setShowDisqualifyConfirm] = useState(false);
  const [disqualifyRemarks, setDisqualifyRemarks] = useState("");

  const isSiftable = application.status === "UNDER_SIFTING";
  const isSchedulable = canScheduleInterview(application);
  // Manual, single-application alternative to the "Import PQE Scores" Excel
  // upload above the table - same underlying score, just for admins who'd
  // rather key in one number than build a spreadsheet for it.
  const canEnterExamScore = application.status === "QUALIFIED" && application.examinationScore === null;
  const isMovableToCompliance = application.status === "FOR_INTERVIEW";
  const isInCompliance = application.status === "FOR_COMPLIANCE";
  const isOathTaking = application.status === "FOR_OATH_TAKING";
  const allComplianceVerified =
    complianceItems !== null && complianceItems.length > 0 && complianceItems.every((item) => item.status === "VERIFIED");
  const isOathSchedulable = isInCompliance && allComplianceVerified;

  // Fetched once the applicant enters Compliance so "Schedule Oath-Taking"
  // knows whether every requirement has actually been verified yet - not
  // derivable from AdminApplication alone, which has no per-requirement detail.
  useEffect(() => {
    if (application.complianceRequestedAt === null) {
      setComplianceItems(null);
      return;
    }
    let cancelled = false;
    listComplianceItems(application.id)
      .then((items) => {
        if (!cancelled) setComplianceItems(items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [application.id, application.complianceRequestedAt, complianceRefreshToken]);

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
      setShowDetailsModal(false);
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
      setShowDetailsModal(false);
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
      setShowDetailsModal(false);
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

  async function handleMoveToCompliance() {
    setMovingToCompliance(true);
    try {
      const updated = await moveToCompliance(application.id);
      onSifted(updated);
      toast.success(
        `${application.applicant.firstName} ${application.applicant.lastName} was moved to Compliance to Requirements.`,
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to move to Compliance");
    } finally {
      setMovingToCompliance(false);
    }
  }

  async function handleRejectAfterInterview() {
    try {
      const updated = await rejectAfterInterview(application.id, {
        ...(notSelectedRemarks ? { remarks: notSelectedRemarks } : {}),
      });
      onSifted(updated);
      toast.success(`${application.applicant.firstName} ${application.applicant.lastName} was marked not selected.`);
      setShowNotSelectedConfirm(false);
      setNotSelectedRemarks("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to mark not selected");
    }
  }

  async function handleRejectAfterCompliance() {
    try {
      const updated = await rejectAfterCompliance(application.id, {
        ...(disqualifyRemarks ? { remarks: disqualifyRemarks } : {}),
      });
      onSifted(updated);
      toast.success(`${application.applicant.firstName} ${application.applicant.lastName} was disqualified.`);
      setShowDisqualifyConfirm(false);
      setDisqualifyRemarks("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to disqualify");
    }
  }

  async function handleScheduleOathTakingSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!oathForm.scheduledAt) {
      setFieldErrors({ scheduledAt: "Date/time is required." });
      return;
    }
    if (!oathForm.venue.trim()) {
      setFieldErrors({ venue: "Venue is required." });
      return;
    }
    setSchedulingOath(true);
    try {
      const updated = await scheduleOathTaking(application.id, {
        scheduledAt: oathForm.scheduledAt,
        venue: oathForm.venue,
        ...(oathForm.notes ? { notes: oathForm.notes } : {}),
      });
      onScheduled(updated);
      toast.success(`${application.applicant.firstName} ${application.applicant.lastName} was scheduled for oath-taking.`);
      setOathForm(emptyOathForm);
      setShowDetailsModal(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(getFieldErrors(err));
      } else {
        setError("Failed to schedule oath-taking");
      }
    } finally {
      setSchedulingOath(false);
    }
  }

  async function handleMarkHired() {
    try {
      const updated = await markHired(application.id);
      onSifted(updated);
      toast.success(`${application.applicant.firstName} ${application.applicant.lastName} was marked hired.`);
      setShowMarkHiredConfirm(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to mark hired");
    }
  }

  const incompleteScoring = tabulation !== null && tabulation.panelistsSubmitted < tabulation.panelistsAssigned;
  const hasDetails =
    isSiftable ||
    isSchedulable ||
    canEnterExamScore ||
    isOathSchedulable ||
    application.siftedAt !== null ||
    application.interviewScheduledAt !== null ||
    application.complianceRequestedAt !== null ||
    application.oathTakingScheduledAt !== null ||
    application.hiredAt !== null ||
    application.rejectedAt !== null ||
    (tabulation !== null && tabulation.panelistsAssigned > 0);

  function detailsButtonLabel(): string {
    if (isSiftable) return "Sift";
    if (canEnterExamScore) return "Enter PQE Score";
    if (isSchedulable) return "Evaluate Applicant";
    if (isOathSchedulable) return "Schedule Oath-Taking";
    return "Details";
  }

  return (
    <>
      <tr>
        <td>
          {application.applicant.firstName} {application.applicant.lastName}
        </td>
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
            {application.complianceRequestedAt !== null && (
              <button type="button" className="secondary" onClick={() => setShowComplianceReview(true)}>
                Manage Compliance
              </button>
            )}
            {isMovableToCompliance && (
              <button type="button" disabled={movingToCompliance} onClick={handleMoveToCompliance}>
                {movingToCompliance && <Spinner size="sm" onDark />}
                {movingToCompliance ? "Moving..." : "Move to Compliance"}
              </button>
            )}
            {isMovableToCompliance && (
              <button type="button" className="danger" onClick={() => setShowNotSelectedConfirm(true)}>
                Not Selected
              </button>
            )}
            {isInCompliance && (
              <button type="button" className="danger" onClick={() => setShowDisqualifyConfirm(true)}>
                Disqualify
              </button>
            )}
            {isOathTaking && (
              <button type="button" onClick={() => setShowMarkHiredConfirm(true)}>
                Mark Hired
              </button>
            )}
            {hasDetails && (
              <button type="button" className="secondary" onClick={() => setShowDetailsModal(true)}>
                {detailsButtonLabel()}
              </button>
            )}
          </div>
        </td>
      </tr>
      <Modal
        open={showDetailsModal}
        wide
        title={`${detailsButtonLabel()} — ${application.applicant.firstName} ${application.applicant.lastName}`}
        onClose={() => setShowDetailsModal(false)}
        footer={
          <button type="button" className="secondary" onClick={() => setShowDetailsModal(false)}>
            Close
          </button>
        }
      >
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
        {application.rejectedAt !== null && (
          <div className="card-inset">
            <p className="field-hint">
              {application.status === "DISQUALIFIED" ? "Disqualified" : "Marked not selected"}{" "}
              {new Date(application.rejectedAt).toLocaleString()}.
            </p>
            {application.rejectionRemarks && <p>{application.rejectionRemarks}</p>}
          </div>
        )}
        {application.complianceRequestedAt !== null && (
          <div className="card-inset">
            <p className="field-hint">
              Moved to Compliance to Requirements {new Date(application.complianceRequestedAt).toLocaleString()}
              {complianceItems !== null &&
                ` — ${complianceItems.filter((item) => item.status === "VERIFIED").length}/${complianceItems.length} requirement(s) verified`}
              .
            </p>
          </div>
        )}
        {application.oathTakingScheduledAt !== null && (
          <div className="card-inset">
            <p className="field-hint">Oath-taking scheduled:</p>
            <ul>
              <li>
                <strong>When:</strong> {new Date(application.oathTakingScheduledAt).toLocaleString()}
              </li>
              <li>
                <strong>Where:</strong> {application.oathTakingVenue}
              </li>
              {application.oathTakingNotes && (
                <li>
                  <strong>Notes:</strong> {application.oathTakingNotes}
                </li>
              )}
            </ul>
          </div>
        )}
        {application.hiredAt !== null && (
          <div className="card-inset">
            <p className="field-hint">Hired {new Date(application.hiredAt).toLocaleString()}.</p>
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
              <textarea id={`remarks-${application.id}`} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
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
        {isOathSchedulable && (
          <form onSubmit={handleScheduleOathTakingSubmit} className="field-grid" noValidate>
            <div className={fieldErrors.scheduledAt ? "field has-error" : "field"}>
              <label htmlFor={`oath-scheduled-at-${application.id}`} className="required">
                When
              </label>
              <input
                id={`oath-scheduled-at-${application.id}`}
                type="datetime-local"
                required
                value={oathForm.scheduledAt}
                onChange={(e) => setOathForm({ ...oathForm, scheduledAt: e.target.value })}
              />
              <FieldError message={fieldErrors.scheduledAt} />
            </div>
            <div className={fieldErrors.venue ? "field has-error" : "field"}>
              <label htmlFor={`oath-venue-${application.id}`} className="required">
                Venue
              </label>
              <input
                id={`oath-venue-${application.id}`}
                required
                placeholder="e.g. DILG Regional Office, Multi-Purpose Hall"
                value={oathForm.venue}
                onChange={(e) => setOathForm({ ...oathForm, venue: e.target.value })}
              />
              <FieldError message={fieldErrors.venue} />
            </div>
            <div className="field">
              <label htmlFor={`oath-notes-${application.id}`}>Additional instructions (optional)</label>
              <textarea
                id={`oath-notes-${application.id}`}
                placeholder="e.g. Bring a valid ID"
                value={oathForm.notes}
                onChange={(e) => setOathForm({ ...oathForm, notes: e.target.value })}
              />
            </div>
            <div className="field" style={{ alignSelf: "end" }}>
              <button type="submit" disabled={schedulingOath}>
                {schedulingOath && <Spinner size="sm" onDark />}
                {schedulingOath ? "Saving..." : "Save oath-taking schedule"}
              </button>
            </div>
          </form>
        )}
      </Modal>
      {showDocuments && (
        <ApplicantDocumentsModal
          applicantId={application.applicant.id}
          applicantName={`${application.applicant.firstName} ${application.applicant.lastName}`}
          onClose={() => setShowDocuments(false)}
        />
      )}
      {showComplianceReview && (
        <ComplianceReviewModal
          applicationId={application.id}
          applicantName={`${application.applicant.firstName} ${application.applicant.lastName}`}
          onClose={() => {
            setShowComplianceReview(false);
            setComplianceRefreshToken((prev) => prev + 1);
          }}
        />
      )}
      <ConfirmDialog
        open={showMarkHiredConfirm}
        title="Mark hired?"
        description={
          <>
            Confirms <strong>{application.applicant.firstName} {application.applicant.lastName}</strong> has
            completed the oath-taking ceremony for <strong>{application.jobPosting.title}</strong>.
          </>
        }
        confirmLabel="Mark Hired"
        danger={false}
        onConfirm={handleMarkHired}
        onCancel={() => setShowMarkHiredConfirm(false)}
      />
      <ConfirmDialog
        open={showNotSelectedConfirm}
        title="Mark not selected?"
        description={
          <>
            <p>
              <strong>{application.applicant.firstName} {application.applicant.lastName}</strong> will be marked not
              selected for <strong>{application.jobPosting.title}</strong> and sent a regret email. This can&apos;t be
              undone.
            </p>
            <div className="field">
              <label htmlFor={`not-selected-remarks-${application.id}`}>Remarks (optional, included in the email)</label>
              <textarea
                id={`not-selected-remarks-${application.id}`}
                value={notSelectedRemarks}
                onChange={(e) => setNotSelectedRemarks(e.target.value)}
              />
            </div>
          </>
        }
        confirmLabel="Not Selected"
        onConfirm={handleRejectAfterInterview}
        onCancel={() => {
          setShowNotSelectedConfirm(false);
          setNotSelectedRemarks("");
        }}
      />
      <ConfirmDialog
        open={showDisqualifyConfirm}
        title="Disqualify?"
        description={
          <>
            <p>
              <strong>{application.applicant.firstName} {application.applicant.lastName}</strong> will be disqualified
              from <strong>{application.jobPosting.title}</strong> and sent a regret email. This can&apos;t be undone.
            </p>
            <div className="field">
              <label htmlFor={`disqualify-remarks-${application.id}`}>Remarks (optional, included in the email)</label>
              <textarea
                id={`disqualify-remarks-${application.id}`}
                value={disqualifyRemarks}
                onChange={(e) => setDisqualifyRemarks(e.target.value)}
              />
            </div>
          </>
        }
        confirmLabel="Disqualify"
        onConfirm={handleRejectAfterCompliance}
        onCancel={() => {
          setShowDisqualifyConfirm(false);
          setDisqualifyRemarks("");
        }}
      />
    </>
  );
}
