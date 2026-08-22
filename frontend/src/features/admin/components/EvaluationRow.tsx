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
import { EDUCATION_LEVEL_LABELS } from "@/shared/constants/educationLevels";
import { ELIGIBILITY_LABELS } from "@/shared/constants/eligibility";
import { computeQualificationMatch, type MatchStatus } from "@/shared/utils/qualificationMatch";
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
import { AssignPositionModal } from "./AssignPositionModal";
import type { AdminApplication, ApplicationComplianceItem, EvaluationDecision, HirePrediction, TabulationResult } from "../types";

interface Props {
  // This applicant's application(s) - a single-posting applicant passes an
  // array of 1 (rendering/behaving exactly as before); a multi-posting
  // applicant passes 2+, in which case every action on this row (Sift, PQE
  // score, Schedule Interview, Move to Compliance, Not Selected,
  // Disqualify, Schedule Oath-Taking) applies to all of them at once from
  // one form/click - client requirement: "1 data row only... All
  // application will move at the same time." Callers only ever pass a
  // status-uniform group - EvaluateApplicantsPage falls back to
  // ApplicantGroupSummaryRow's per-posting expansion for the (should be
  // rare/historical-only) case where a group's applications have diverged.
  applications: AdminApplication[];
  onSifted: (updated: AdminApplication) => void;
  onScheduled: (updated: AdminApplication) => void;
  tabulationByPosting: Record<string, TabulationResult>;
  // Keyed by application id - undefined until the batched fetch resolves
  // (renders "-"), same feature/percentage for every application in a
  // multi-posting group since it's derived from the shared applicant
  // profile, not anything posting-specific. Purely informational - never
  // read by any Sift/decision logic in this component.
  predictionByApplicationId?: Record<string, HirePrediction>;
  // Called after a successful Mark Hired/Assign Position so the page can
  // refetch - hiring also auto-closes the applicant's other open
  // applications (possibly on different postings/pages), which this row
  // alone can't see.
  onHired: () => void | Promise<void>;
}

function canScheduleInterview(application: AdminApplication): boolean {
  return application.status === "QUALIFIED" && application.examinationScore !== null;
}

// Purely informational - never feeds any Sift/decision logic in this
// component. The tooltip surfaces the linear model's per-feature
// contributions (its explanation) rather than just the bare number.
function renderHirePrediction(prediction: HirePrediction | undefined) {
  if (!prediction) return "-";
  if (prediction.percentage === null) {
    return (
      <span className="field-hint">
        Not enough data ({prediction.sampleSize}/{prediction.minimumRequired})
      </span>
    );
  }
  // The model is a logistic regression, so a feature's contribution is to
  // the underlying log-odds, not directly a percentage-point amount -
  // labeled as "higher/lower" influence rather than a false-precision "+X%".
  const tooltip = prediction.breakdown
    .map((b) => `${b.label}: ${b.contribution >= 0 ? "pushes higher" : "pushes lower"} (${b.contribution})`)
    .join("\n");
  return <span title={tooltip}>{prediction.percentage}%</span>;
}

// Reuses the existing status-badge color classes (qualified=green,
// rejected=red, withdrawn=gray) rather than inventing new ones - see
// index.css's .badge rules.
function matchBadge(status: MatchStatus): { className: string; label: string } {
  if (status === "MEETS") return { className: "badge qualified", label: "Meets" };
  if (status === "BELOW") return { className: "badge rejected", label: "Below minimum" };
  return { className: "badge withdrawn", label: "No automatic check" };
}

/**
 * Runs one action against every application in the group and reports back
 * which postings succeeded/failed, rather than failing the whole batch the
 * moment one rejects (Promise.all would). Every group this row renders for
 * is status-uniform to start with, so a partial failure here should be rare
 * (a genuine per-application server error, not a precondition mismatch),
 * but it's still surfaced honestly rather than silently dropped.
 */
async function applyToGroup(
  applications: AdminApplication[],
  action: (application: AdminApplication) => Promise<AdminApplication>,
  onEach: (updated: AdminApplication) => void,
): Promise<{ succeededCount: number; failedTitles: string[] }> {
  const results = await Promise.allSettled(applications.map(action));
  const failedTitles: string[] = [];
  let succeededCount = 0;
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      onEach(result.value);
      succeededCount += 1;
    } else {
      failedTitles.push(applications[index]!.jobPosting.title);
    }
  });
  return { succeededCount, failedTitles };
}

const emptyScheduleForm = { scheduledAt: "", scheduledEndAt: "", venue: "", attire: "", notes: "" };
const emptyOathForm = { scheduledAt: "", venue: "", notes: "" };

export function EvaluationRow({
  applications,
  onSifted,
  onScheduled,
  tabulationByPosting,
  predictionByApplicationId,
  onHired,
}: Props) {
  const toast = useToast();
  const primary = applications[0]!;
  const isGroup = applications.length > 1;
  const applicantName = `${primary.applicant.firstName} ${primary.applicant.lastName}`;

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
  const [showAssignPosition, setShowAssignPosition] = useState(false);
  const [showNotSelectedConfirm, setShowNotSelectedConfirm] = useState(false);
  const [notSelectedRemarks, setNotSelectedRemarks] = useState("");
  const [showDisqualifyConfirm, setShowDisqualifyConfirm] = useState(false);
  const [disqualifyRemarks, setDisqualifyRemarks] = useState("");

  const isSiftable = applications.every((a) => a.status === "UNDER_SIFTING");
  const isSchedulable = applications.every(canScheduleInterview);
  // Manual, single-application alternative to the "Import PQE Scores" Excel
  // upload above the table - same underlying score, just for admins who'd
  // rather key in one number than build a spreadsheet for it. The Excel
  // import itself still matches per posting - see docs/decisions.md.
  const canEnterExamScore = applications.every((a) => a.status === "QUALIFIED" && a.examinationScore === null);
  const isMovableToCompliance = applications.every((a) => a.status === "FOR_INTERVIEW");
  const isInCompliance = applications.every((a) => a.status === "FOR_COMPLIANCE");
  const isOathTaking = applications.every((a) => a.status === "FOR_OATH_TAKING");
  // Hiring is inherently exclusive to one posting - a group that's all
  // reached Oath-Taking together doesn't get one Mark Hired action, it gets
  // the "Assign Position" picker instead (client requirement: manual pick,
  // no automatic recommendation - see docs/decisions.md).
  const showAssignPositionAction = isGroup && isOathTaking;
  // Compliance items are only fetched/reviewed against the group's first
  // application for now - ComplianceRequirement is a single global catalog
  // so every member's snapshot is equivalent, but per-item verify/reject
  // mirroring across the group is a follow-up, not yet implemented (see
  // docs/decisions.md). Schedule Oath-Taking gates on this one snapshot.
  const allComplianceVerified =
    complianceItems !== null && complianceItems.length > 0 && complianceItems.every((item) => item.status === "VERIFIED");
  const isOathSchedulable = isInCompliance && allComplianceVerified;

  useEffect(() => {
    if (primary.complianceRequestedAt === null) {
      setComplianceItems(null);
      return;
    }
    let cancelled = false;
    listComplianceItems(primary.id)
      .then((items) => {
        if (!cancelled) setComplianceItems(items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [primary.id, primary.complianceRequestedAt, complianceRefreshToken]);

  function tabulationFor(application: AdminApplication) {
    return tabulationByPosting[application.jobPosting.id]?.rows.find((row) => row.applicationId === application.id) ?? null;
  }
  function panelistsFor(application: AdminApplication) {
    return tabulationByPosting[application.jobPosting.id]?.panelists ?? [];
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { succeededCount, failedTitles } = await applyToGroup(
        applications,
        (app) => siftApplication(app.id, { decision, ...(remarks ? { remarks } : {}) }),
        onSifted,
      );
      if (failedTitles.length === 0) {
        toast.success(
          `Sifting decision saved for ${applicantName}${isGroup ? ` (${succeededCount} posting(s))` : ""}: ${
            decision === "QUALIFIED" ? "Qualified" : "Not qualified"
          }.`,
        );
        setShowDetailsModal(false);
      } else {
        setError(`Saved for ${succeededCount}/${applications.length} posting(s). Failed: ${failedTitles.join(", ")}.`);
      }
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
      const { succeededCount, failedTitles } = await applyToGroup(
        applications,
        (app) =>
          scheduleInterview(app.id, {
            scheduledAt: scheduleForm.scheduledAt,
            ...(scheduleForm.scheduledEndAt ? { scheduledEndAt: scheduleForm.scheduledEndAt } : {}),
            venue: scheduleForm.venue,
            ...(scheduleForm.attire ? { attire: scheduleForm.attire } : {}),
            ...(scheduleForm.notes ? { notes: scheduleForm.notes } : {}),
          }),
        onScheduled,
      );
      if (failedTitles.length === 0) {
        toast.success(`${applicantName} was scheduled for evaluation${isGroup ? ` (${succeededCount} posting(s))` : ""}.`);
        setScheduleForm(emptyScheduleForm);
        setShowDetailsModal(false);
      } else {
        setError(`Scheduled for ${succeededCount}/${applications.length} posting(s). Failed: ${failedTitles.join(", ")}.`);
      }
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
      // onSifted is really just "replace this row's application in the
      // parent's list" - identical to onScheduled below, reused here rather
      // than adding a third prop that would do the exact same thing.
      const { succeededCount, failedTitles } = await applyToGroup(
        applications,
        (app) => setExaminationScore(app.id, parsedScore),
        onSifted,
      );
      if (failedTitles.length === 0) {
        toast.success(`PQE score of ${parsedScore} recorded for ${applicantName}${isGroup ? ` (${succeededCount} posting(s))` : ""}.`);
        setExamScore("");
        setShowDetailsModal(false);
      } else {
        setError(`Recorded for ${succeededCount}/${applications.length} posting(s). Failed: ${failedTitles.join(", ")}.`);
      }
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
      const { succeededCount, failedTitles } = await applyToGroup(applications, (app) => moveToCompliance(app.id), onSifted);
      if (failedTitles.length === 0) {
        toast.success(`${applicantName} was moved to Compliance to Requirements${isGroup ? ` (${succeededCount} posting(s))` : ""}.`);
      } else {
        toast.error(`Moved ${succeededCount}/${applications.length} posting(s) to Compliance. Failed: ${failedTitles.join(", ")}.`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to move to Compliance");
    } finally {
      setMovingToCompliance(false);
    }
  }

  async function handleRejectAfterInterview() {
    try {
      const { succeededCount, failedTitles } = await applyToGroup(
        applications,
        (app) => rejectAfterInterview(app.id, { ...(notSelectedRemarks ? { remarks: notSelectedRemarks } : {}) }),
        onSifted,
      );
      if (failedTitles.length === 0) {
        toast.success(`${applicantName} was marked not selected${isGroup ? ` (${succeededCount} posting(s))` : ""}.`);
      } else {
        toast.error(`Marked ${succeededCount}/${applications.length} posting(s) not selected. Failed: ${failedTitles.join(", ")}.`);
      }
      setShowNotSelectedConfirm(false);
      setNotSelectedRemarks("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to mark not selected");
    }
  }

  async function handleRejectAfterCompliance() {
    try {
      const { succeededCount, failedTitles } = await applyToGroup(
        applications,
        (app) => rejectAfterCompliance(app.id, { ...(disqualifyRemarks ? { remarks: disqualifyRemarks } : {}) }),
        onSifted,
      );
      if (failedTitles.length === 0) {
        toast.success(`${applicantName} was disqualified${isGroup ? ` (${succeededCount} posting(s))` : ""}.`);
      } else {
        toast.error(`Disqualified ${succeededCount}/${applications.length} posting(s). Failed: ${failedTitles.join(", ")}.`);
      }
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
      const { succeededCount, failedTitles } = await applyToGroup(
        applications,
        (app) =>
          scheduleOathTaking(app.id, {
            scheduledAt: oathForm.scheduledAt,
            venue: oathForm.venue,
            ...(oathForm.notes ? { notes: oathForm.notes } : {}),
          }),
        onScheduled,
      );
      if (failedTitles.length === 0) {
        toast.success(`${applicantName} was scheduled for oath-taking${isGroup ? ` (${succeededCount} posting(s))` : ""}.`);
        setOathForm(emptyOathForm);
        setShowDetailsModal(false);
      } else {
        setError(`Scheduled for ${succeededCount}/${applications.length} posting(s). Failed: ${failedTitles.join(", ")}.`);
      }
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
      const updated = await markHired(primary.id);
      onSifted(updated);
      toast.success(`${applicantName} was marked hired.`);
      setShowMarkHiredConfirm(false);
      // Hiring here auto-closes the applicant's other open applications
      // server-side - refetch everything so those rows (possibly on
      // different postings/pages) pick up their new Not Selected status.
      await onHired();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to mark hired");
    }
  }

  const totalTrainingHours = primary.applicant.ldInterventions.reduce((sum, entry) => sum + entry.numberOfHours, 0);
  const hasDetails =
    isSiftable ||
    isSchedulable ||
    canEnterExamScore ||
    isOathSchedulable ||
    primary.siftedAt !== null ||
    primary.interviewScheduledAt !== null ||
    primary.complianceRequestedAt !== null ||
    primary.oathTakingScheduledAt !== null ||
    primary.hiredAt !== null ||
    primary.rejectedAt !== null ||
    applications.some((app) => (tabulationFor(app)?.panelistsAssigned ?? 0) > 0);

  function detailsButtonLabel(): string {
    if (isSiftable) return "Sift";
    if (canEnterExamScore) return "Enter PQE Score";
    if (isSchedulable) return "Evaluate Applicant";
    if (isOathSchedulable) return "Schedule Oath-Taking";
    return "Details";
  }

  const primaryTabulation = tabulationFor(primary);

  return (
    <>
      <tr>
        <td>{applicantName}</td>
        <td>{applications.map((app) => app.jobPosting.title).join(", ")}</td>
        <td>{new Date(primary.submittedAt).toLocaleDateString()}</td>
        <td>
          <span className={`badge ${primary.status.toLowerCase()}`}>{APPLICATION_STATUS_LABELS[primary.status]}</span>
        </td>
        <td>{primary.examinationScore ?? "-"}</td>
        <td>
          {primaryTabulation?.average !== undefined && primaryTabulation.average !== null ? primaryTabulation.average.toFixed(1) : "-"}
        </td>
        <td>{applications.map((app) => tabulationFor(app)?.rank ?? "-").join(", ")}</td>
        <td>{renderHirePrediction(predictionByApplicationId?.[primary.id])}</td>
        <td>
          <div className="data-table-actions data-table-actions--uniform">
            <button type="button" className="secondary" onClick={() => setShowDocuments(true)}>
              View Documents
            </button>
            {primary.complianceRequestedAt !== null && (
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
            {isOathTaking && !showAssignPositionAction && (
              <button type="button" onClick={() => setShowMarkHiredConfirm(true)}>
                Mark Hired
              </button>
            )}
            {showAssignPositionAction && (
              <button type="button" onClick={() => setShowAssignPosition(true)}>
                Assign Position
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
        title={`${detailsButtonLabel()}: ${applicantName}`}
        onClose={() => setShowDetailsModal(false)}
        footer={
          <button type="button" className="secondary" onClick={() => setShowDetailsModal(false)}>
            Close
          </button>
        }
      >
        <ErrorBanner message={error} />
        {applications.map((application) => {
          const qualificationMatch = computeQualificationMatch(application);
          return (
            <div className="card-inset" key={application.id}>
              {isGroup && (
                <p className="field-hint">
                  <strong>{application.jobPosting.title}</strong> - each posting keeps its own qualification standards
                  even though the decision below applies to all of them at once.
                </p>
              )}
              <p className="field-hint">
                Qualification Standards vs. this applicant. The badge is an automatic hint from structured profile/posting
                data only - the free-text standard is still the authoritative wording to weigh when sifting.
              </p>
              <ul className="qs-match-list">
                <li>
                  <div className="qs-match-row">
                    <strong>Education</strong>
                    <span className={matchBadge(qualificationMatch.education).className}>
                      {matchBadge(qualificationMatch.education).label}
                    </span>
                  </div>
                  <p className="field-hint">{application.jobPosting.qualificationEducation}</p>
                  {application.jobPosting.minEducationLevel && (
                    <p className="field-hint">
                      Applicant: {EDUCATION_LEVEL_LABELS[application.applicant.educationLevel]}. Minimum required:{" "}
                      {EDUCATION_LEVEL_LABELS[application.jobPosting.minEducationLevel]}
                    </p>
                  )}
                </li>
                <li>
                  <div className="qs-match-row">
                    <strong>Training</strong>
                    <span className={matchBadge(qualificationMatch.training).className}>
                      {matchBadge(qualificationMatch.training).label}
                    </span>
                  </div>
                  <p className="field-hint">{application.jobPosting.qualificationTraining}</p>
                  {application.jobPosting.minTrainingHours !== null && (
                    <p className="field-hint">
                      Applicant: {totalTrainingHours} hour(s) total (from Learning &amp; Development entries). Minimum
                      required: {application.jobPosting.minTrainingHours} hour(s)
                    </p>
                  )}
                </li>
                <li>
                  <div className="qs-match-row">
                    <strong>Experience</strong>
                    <span className={matchBadge(qualificationMatch.experience).className}>
                      {matchBadge(qualificationMatch.experience).label}
                    </span>
                  </div>
                  <p className="field-hint">{application.jobPosting.qualificationExperience}</p>
                  {application.jobPosting.minYearsExperience !== null && (
                    <p className="field-hint">
                      Applicant: {application.applicant.yearsOfExperience} year(s). Minimum required:{" "}
                      {application.jobPosting.minYearsExperience} year(s)
                    </p>
                  )}
                </li>
                <li>
                  <div className="qs-match-row">
                    <strong>Eligibility</strong>
                    <span className={matchBadge(qualificationMatch.eligibility).className}>
                      {matchBadge(qualificationMatch.eligibility).label}
                    </span>
                  </div>
                  <p className="field-hint">{application.jobPosting.qualificationEligibility}</p>
                  {application.jobPosting.requiredEligibilityTypes.length > 0 && (
                    <p className="field-hint">
                      Applicant:{" "}
                      {application.applicant.hasEligibility
                        ? ELIGIBILITY_LABELS[application.applicant.eligibilityType]
                        : "No eligibility on file"}
                      . Required (any of):{" "}
                      {application.jobPosting.requiredEligibilityTypes.map((type) => ELIGIBILITY_LABELS[type]).join(", ")}
                    </p>
                  )}
                </li>
              </ul>
            </div>
          );
        })}
        {!isSiftable && primary.siftedAt !== null && (
          <div className="card-inset">
            <p className="field-hint">
              Sifted {new Date(primary.siftedAt).toLocaleString()}: {primary.status === "QUALIFIED" ? "Qualified" : "Not qualified"}
            </p>
            {primary.siftingRemarks && <p>{primary.siftingRemarks}</p>}
          </div>
        )}
        {primary.interviewScheduledAt !== null && (
          <div className="card-inset">
            <p className="field-hint">Evaluation scheduled:</p>
            <ul>
              {primary.interviewScheduledEndAt !== null ? (
                <>
                  <li>
                    <strong>Day 1:</strong> {new Date(primary.interviewScheduledAt).toLocaleString()}
                  </li>
                  <li>
                    <strong>Day 2:</strong> {new Date(primary.interviewScheduledEndAt).toLocaleString()}
                  </li>
                </>
              ) : (
                <li>
                  <strong>When:</strong> {new Date(primary.interviewScheduledAt).toLocaleString()}
                </li>
              )}
              <li>
                <strong>Where:</strong> {primary.interviewVenue}
              </li>
              {primary.interviewAttire && (
                <li>
                  <strong>What to wear:</strong> {primary.interviewAttire}
                </li>
              )}
              {primary.interviewNotes && (
                <li>
                  <strong>Notes:</strong> {primary.interviewNotes}
                </li>
              )}
            </ul>
          </div>
        )}
        {primary.rejectedAt !== null && (
          <div className="card-inset">
            <p className="field-hint">
              {primary.status === "DISQUALIFIED" ? "Disqualified" : "Marked not selected"}{" "}
              {new Date(primary.rejectedAt).toLocaleString()}.
            </p>
            {primary.rejectionRemarks && <p>{primary.rejectionRemarks}</p>}
          </div>
        )}
        {primary.complianceRequestedAt !== null && (
          <div className="card-inset">
            <p className="field-hint">
              Moved to Compliance to Requirements {new Date(primary.complianceRequestedAt).toLocaleString()}
              {complianceItems !== null &&
                ` (${complianceItems.filter((item) => item.status === "VERIFIED").length}/${complianceItems.length} requirement(s) verified)`}
              .
            </p>
            {isGroup && (
              <p className="field-hint">
                Compliance items are reviewed against {applications[0]!.jobPosting.title} - verify/reject there covers
                this posting only, not the others in this group yet.
              </p>
            )}
          </div>
        )}
        {primary.oathTakingScheduledAt !== null && (
          <div className="card-inset">
            <p className="field-hint">Oath-taking scheduled:</p>
            <ul>
              <li>
                <strong>When:</strong> {new Date(primary.oathTakingScheduledAt).toLocaleString()}
              </li>
              <li>
                <strong>Where:</strong> {primary.oathTakingVenue}
              </li>
              {primary.oathTakingNotes && (
                <li>
                  <strong>Notes:</strong> {primary.oathTakingNotes}
                </li>
              )}
            </ul>
          </div>
        )}
        {primary.hiredAt !== null && (
          <div className="card-inset">
            <p className="field-hint">Hired {new Date(primary.hiredAt).toLocaleString()}.</p>
          </div>
        )}
        {applications.map((application) => {
          const t = tabulationFor(application);
          if (!t || t.panelistsAssigned === 0) return null;
          const incomplete = t.panelistsSubmitted < t.panelistsAssigned;
          return (
            <div className="card-inset" key={application.id}>
              <p className="field-hint">
                {isGroup && <strong>{application.jobPosting.title}: </strong>}
                Panel scores ({t.panelistsSubmitted}/{t.panelistsAssigned} submitted):
              </p>
              <ul className="panel-score-list">
                {panelistsFor(application).map((panelist) => (
                  <li key={panelist.id}>
                    {panelist.email}: {t.perPanelist[panelist.id] ?? "not yet scored"}
                  </li>
                ))}
              </ul>
              {incomplete && (
                <p className="field-warning">
                  {t.panelistsAssigned - t.panelistsSubmitted} of {t.panelistsAssigned} panelist(s) haven&apos;t submitted
                  scores yet.
                </p>
              )}
            </div>
          );
        })}
        {isSiftable && (
          <form onSubmit={handleSubmit} className="field-grid" noValidate>
            <div className="field">
              <label htmlFor={`decision-${primary.id}`}>Sifting decision{isGroup ? ` (applies to all ${applications.length} postings)` : ""}</label>
              <select
                id={`decision-${primary.id}`}
                value={decision}
                onChange={(e) => setDecision(e.target.value as EvaluationDecision)}
              >
                <option value="QUALIFIED">Qualified</option>
                <option value="NOT_QUALIFIED">Not qualified</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor={`remarks-${primary.id}`}>Remarks (optional)</label>
              <textarea id={`remarks-${primary.id}`} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
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
              <label htmlFor={`exam-score-${primary.id}`} className="required">
                PQE score{isGroup ? ` (applies to all ${applications.length} postings)` : ""}
              </label>
              <input
                id={`exam-score-${primary.id}`}
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
              <label htmlFor={`scheduled-at-${primary.id}`} className="required">
                From
              </label>
              <input
                id={`scheduled-at-${primary.id}`}
                type="datetime-local"
                required
                value={scheduleForm.scheduledAt}
                onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledAt: e.target.value })}
              />
              <FieldError message={fieldErrors.scheduledAt} />
            </div>
            <div className={fieldErrors.scheduledEndAt ? "field has-error" : "field"}>
              <label htmlFor={`scheduled-end-at-${primary.id}`}>To (optional)</label>
              <input
                id={`scheduled-end-at-${primary.id}`}
                type="datetime-local"
                value={scheduleForm.scheduledEndAt}
                onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledEndAt: e.target.value })}
              />
              <FieldError message={fieldErrors.scheduledEndAt} />
            </div>
            <div className={fieldErrors.venue ? "field has-error" : "field"}>
              <label htmlFor={`venue-${primary.id}`} className="required">
                Venue
              </label>
              <input
                id={`venue-${primary.id}`}
                required
                placeholder="e.g. DILG Regional Office, Conference Room B"
                value={scheduleForm.venue}
                onChange={(e) => setScheduleForm({ ...scheduleForm, venue: e.target.value })}
              />
              <FieldError message={fieldErrors.venue} />
            </div>
            <div className="field">
              <label htmlFor={`attire-${primary.id}`}>What to wear (optional)</label>
              <input
                id={`attire-${primary.id}`}
                placeholder="e.g. Business attire"
                value={scheduleForm.attire}
                onChange={(e) => setScheduleForm({ ...scheduleForm, attire: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor={`notes-${primary.id}`}>Additional instructions (optional)</label>
              <textarea
                id={`notes-${primary.id}`}
                placeholder="e.g. Bring a valid ID and your original documents"
                value={scheduleForm.notes}
                onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
              />
            </div>
            <div className="field" style={{ alignSelf: "end" }}>
              <button type="submit" disabled={scheduling}>
                {scheduling && <Spinner size="sm" onDark />}
                {scheduling ? "Saving..." : isGroup ? `Save evaluation schedule (${applications.length} postings)` : "Save evaluation schedule"}
              </button>
            </div>
          </form>
        )}
        {isOathSchedulable && (
          <form onSubmit={handleScheduleOathTakingSubmit} className="field-grid" noValidate>
            <div className={fieldErrors.scheduledAt ? "field has-error" : "field"}>
              <label htmlFor={`oath-scheduled-at-${primary.id}`} className="required">
                When
              </label>
              <input
                id={`oath-scheduled-at-${primary.id}`}
                type="datetime-local"
                required
                value={oathForm.scheduledAt}
                onChange={(e) => setOathForm({ ...oathForm, scheduledAt: e.target.value })}
              />
              <FieldError message={fieldErrors.scheduledAt} />
            </div>
            <div className={fieldErrors.venue ? "field has-error" : "field"}>
              <label htmlFor={`oath-venue-${primary.id}`} className="required">
                Venue
              </label>
              <input
                id={`oath-venue-${primary.id}`}
                required
                placeholder="e.g. DILG Regional Office, Multi-Purpose Hall"
                value={oathForm.venue}
                onChange={(e) => setOathForm({ ...oathForm, venue: e.target.value })}
              />
              <FieldError message={fieldErrors.venue} />
            </div>
            <div className="field">
              <label htmlFor={`oath-notes-${primary.id}`}>Additional instructions (optional)</label>
              <textarea
                id={`oath-notes-${primary.id}`}
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
        <ApplicantDocumentsModal applicantId={primary.applicant.id} applicantName={applicantName} onClose={() => setShowDocuments(false)} />
      )}
      {showComplianceReview && (
        <ComplianceReviewModal
          applicationId={primary.id}
          applicantName={applicantName}
          onClose={() => {
            setShowComplianceReview(false);
            setComplianceRefreshToken((prev) => prev + 1);
          }}
        />
      )}
      {showAssignPosition && (
        <AssignPositionModal
          applicantName={applicantName}
          candidates={applications}
          onClose={() => setShowAssignPosition(false)}
          onAssigned={onHired}
        />
      )}
      <ConfirmDialog
        open={showMarkHiredConfirm}
        title="Mark hired?"
        description={
          <>
            Confirms <strong>{applicantName}</strong> has completed the oath-taking ceremony for{" "}
            <strong>{primary.jobPosting.title}</strong>.
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
              <strong>{applicantName}</strong> will be marked not selected for{" "}
              <strong>{applications.map((app) => app.jobPosting.title).join(", ")}</strong> and sent a regret email. This
              can&apos;t be undone.
            </p>
            <div className="field">
              <label htmlFor={`not-selected-remarks-${primary.id}`}>Remarks (optional, included in the email)</label>
              <textarea
                id={`not-selected-remarks-${primary.id}`}
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
              <strong>{applicantName}</strong> will be disqualified from{" "}
              <strong>{applications.map((app) => app.jobPosting.title).join(", ")}</strong> and sent a regret email. This
              can&apos;t be undone.
            </p>
            <div className="field">
              <label htmlFor={`disqualify-remarks-${primary.id}`}>Remarks (optional, included in the email)</label>
              <textarea
                id={`disqualify-remarks-${primary.id}`}
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
