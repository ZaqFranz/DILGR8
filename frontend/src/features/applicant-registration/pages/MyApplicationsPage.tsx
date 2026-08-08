import { useEffect, useState } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { listMyApplications, type Application } from "../api/applicationsApi";
import { ApplicationStageTracker } from "../components/ApplicationStageTracker";

function statusBadgeClass(status: string): string {
  return `badge ${status.toLowerCase()}`;
}

export function MyApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyApplications()
      .then(setApplications)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load applications"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingBlock label="Loading your applications..." />;

  return (
    <div>
      <h1>My Applications</h1>
      <ErrorBanner message={error} />
      {applications.length === 0 && <p>You have not submitted any applications yet.</p>}
      {applications.map((application) => (
        <div className="card" key={application.id}>
          <h2>
            {application.jobPosting.title} <span className={statusBadgeClass(application.status)}>{application.status}</span>
          </h2>
          <p>
            <strong>Submitted:</strong> {new Date(application.submittedAt).toLocaleString()}
          </p>
          <ApplicationStageTracker status={application.status} />
          {application.examinationScore !== null && (
            <p className="field-hint">PQE score: {application.examinationScore}</p>
          )}
          {application.interviewScheduledAt !== null && (
            <div className="card-inset">
              <p className="field-hint">Interview details:</p>
              <ul>
                <li>
                  <strong>When:</strong> {new Date(application.interviewScheduledAt).toLocaleString()}
                </li>
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
        </div>
      ))}
    </div>
  );
}
