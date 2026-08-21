import { useEffect, useState } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { APPLICATION_STATUS_LABELS } from "@/shared/constants/applicationStatus";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { useToast } from "@/shared/components/ToastProvider";
import { listMyApplications, withdrawApplication, type Application } from "../api/applicationsApi";
import { ApplicationStageTracker } from "../components/ApplicationStageTracker";
import { ComplianceChecklistSection } from "../components/ComplianceChecklistSection";

const WITHDRAWABLE_STATUSES: Application["status"][] = [
  "SUBMITTED",
  "UNDER_SIFTING",
  "QUALIFIED",
  "FOR_INTERVIEW",
  "FOR_COMPLIANCE",
  "FOR_OATH_TAKING",
];
const COMPLIANCE_VISIBLE_STATUSES: Application["status"][] = ["FOR_COMPLIANCE", "FOR_OATH_TAKING", "HIRED"];

function statusBadgeClass(status: string): string {
  return `badge ${status.toLowerCase()}`;
}

export function MyApplicationsPage() {
  const toast = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingWithdraw, setPendingWithdraw] = useState<Application | null>(null);

  useEffect(() => {
    listMyApplications()
      .then(setApplications)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load applications"))
      .finally(() => setLoading(false));
  }, []);

  async function handleWithdraw() {
    if (!pendingWithdraw) return;
    setError(null);
    try {
      const updated = await withdrawApplication(pendingWithdraw.id);
      setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      toast.success(`Your application for "${pendingWithdraw.jobPosting.title}" was withdrawn.`);
      setPendingWithdraw(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to withdraw application");
    }
  }

  if (loading) return <LoadingBlock label="Loading your applications..." />;

  // Any application in the set having either field set means the shared
  // score note applies to the whole consolidated card, not to one specific
  // posting sub-section - which sibling is "canonical" vs "inheriting" is
  // an implementation detail the applicant doesn't need to track.
  const hasSharedScore = applications.some(
    (application) => application.scoreSourceApplication !== null || application.scoreInheritingApplications.length > 0,
  );

  function renderPosting(application: Application, heading: "h2" | "h3") {
    const Heading = heading;
    return (
      <>
        <Heading>
          {application.jobPosting.title}{" "}
          <span className={statusBadgeClass(application.status)}>{APPLICATION_STATUS_LABELS[application.status]}</span>
        </Heading>
        <p>
          <strong>Submitted:</strong> {new Date(application.submittedAt).toLocaleString()}
        </p>
        <ApplicationStageTracker status={application.status} />
        {application.examinationScore !== null && <p className="field-hint">PQE score: {application.examinationScore}</p>}
        {application.interviewScheduledAt !== null && (
          <div className="card-inset">
            <p className="field-hint">Evaluation of Applicants details:</p>
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
                  <strong>Additional instructions:</strong> {application.interviewNotes}
                </li>
              )}
            </ul>
          </div>
        )}
        {COMPLIANCE_VISIBLE_STATUSES.includes(application.status) && (
          <ComplianceChecklistSection applicationId={application.id} canUpload={application.status === "FOR_COMPLIANCE"} />
        )}
        {application.oathTakingScheduledAt !== null && (
          <div className="card-inset">
            <p className="field-hint">Oath-taking details:</p>
            <ul>
              <li>
                <strong>When:</strong> {new Date(application.oathTakingScheduledAt).toLocaleString()}
              </li>
              <li>
                <strong>Where:</strong> {application.oathTakingVenue}
              </li>
              {application.oathTakingNotes && (
                <li>
                  <strong>Additional instructions:</strong> {application.oathTakingNotes}
                </li>
              )}
            </ul>
          </div>
        )}
        {WITHDRAWABLE_STATUSES.includes(application.status) && (
          <div className="actions-row">
            <button type="button" className="danger" onClick={() => setPendingWithdraw(application)}>
              Withdraw
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <div>
      <h1>My Applications</h1>
      <ErrorBanner message={error} />
      {applications.length === 0 && <p>You have not submitted any applications yet.</p>}

      {applications.length === 1 && (
        <div className="card">{renderPosting(applications[0]!, "h2")}</div>
      )}

      {applications.length > 1 && (
        <div className="card">
          <h2>You&apos;ve applied to {applications.length} job postings</h2>
          {hasSharedScore && (
            <p className="field-hint">Your interview score is shared across all the applications below.</p>
          )}
          {applications.map((application) => (
            <div className="posting-subsection" key={application.id}>
              {renderPosting(application, "h3")}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingWithdraw !== null}
        title="Withdraw application?"
        description={
          <>
            Your application for <strong>{pendingWithdraw?.jobPosting.title}</strong> will be withdrawn. This can't
            be undone. You'd need to submit a new application if you change your mind.
          </>
        }
        confirmLabel="Withdraw"
        onConfirm={handleWithdraw}
        onCancel={() => setPendingWithdraw(null)}
      />
    </div>
  );
}
