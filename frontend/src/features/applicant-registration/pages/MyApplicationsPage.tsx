import { useEffect, useState } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { listMyApplications, type Application } from "../api/applicationsApi";

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
        </div>
      ))}
    </div>
  );
}
