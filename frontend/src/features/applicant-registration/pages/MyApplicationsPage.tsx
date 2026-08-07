import { useEffect, useState } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { listMyApplications, type Application } from "../api/applicationsApi";

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

  if (loading) return <p>Loading your applications...</p>;

  return (
    <div>
      <h1>My Applications</h1>
      <ErrorBanner message={error} />
      {applications.length === 0 && <p>You have not submitted any applications yet.</p>}
      {applications.map((application) => (
        <div className="card" key={application.id}>
          <h2>{application.jobPosting.title}</h2>
          <p>
            <strong>Status:</strong> {application.status}
          </p>
          <p>
            <strong>Submitted:</strong> {new Date(application.submittedAt).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}
