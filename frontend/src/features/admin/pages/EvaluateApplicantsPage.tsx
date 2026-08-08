import { useEffect, useState } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { listJobPostings } from "@/features/job-postings/api/jobPostingsApi";
import type { JobPosting } from "@/features/job-postings/types";
import { listApplicationsForAdmin } from "../api/adminApplicationsApi";
import { getTabulation } from "../api/panelEvaluationsApi";
import { EvaluationRow } from "../components/EvaluationRow";
import { AdminShell } from "../components/AdminShell";
import type { AdminApplication, TabulationResult } from "../types";

const EMPTY_TABULATION: TabulationResult = { panelists: [], rows: [] };

export function EvaluateApplicantsPage() {
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [selectedPostingId, setSelectedPostingId] = useState<string>("");
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [tabulation, setTabulation] = useState<TabulationResult>(EMPTY_TABULATION);
  const [loadingPostings, setLoadingPostings] = useState(true);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listJobPostings()
      .then((loaded) => {
        setPostings(loaded);
        if (loaded.length > 0) {
          setSelectedPostingId(loaded[0]!.id);
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load job postings"))
      .finally(() => setLoadingPostings(false));
  }, []);

  useEffect(() => {
    if (!selectedPostingId) {
      setApplications([]);
      setTabulation(EMPTY_TABULATION);
      return;
    }
    setLoadingApplications(true);
    Promise.all([listApplicationsForAdmin(selectedPostingId), getTabulation(selectedPostingId)])
      .then(([loadedApplications, loadedTabulation]) => {
        setApplications(loadedApplications);
        setTabulation(loadedTabulation);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load applicants"))
      .finally(() => setLoadingApplications(false));
  }, [selectedPostingId]);

  function handleEvaluated(updated: AdminApplication) {
    setApplications((prev) => prev.map((app) => (app.id === updated.id ? updated : app)));
  }

  function handleScheduled(updated: AdminApplication) {
    setApplications((prev) => prev.map((app) => (app.id === updated.id ? updated : app)));
  }

  if (loadingPostings) {
    return (
      <AdminShell>
        <LoadingBlock label="Loading job postings..." />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <h1>Evaluate Applicants</h1>
      <ErrorBanner message={error} />

      {postings.length === 0 && <p>No job postings exist yet. Post one first.</p>}

      {postings.length > 0 && (
        <div className="field" style={{ maxWidth: 420 }}>
          <label htmlFor="posting-select">Job posting</label>
          <select id="posting-select" value={selectedPostingId} onChange={(e) => setSelectedPostingId(e.target.value)}>
            {postings.map((posting) => (
              <option key={posting.id} value={posting.id}>
                {posting.title} ({posting.status})
              </option>
            ))}
          </select>
        </div>
      )}

      {loadingApplications && <LoadingBlock label="Loading applicants..." />}

      {!loadingApplications && selectedPostingId && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Email</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Score</th>
                <th>Panel Avg</th>
                <th>Rank</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {applications.length === 0 && (
                <tr>
                  <td colSpan={8} className="table-empty">
                    No applications for this posting yet.
                  </td>
                </tr>
              )}
              {applications.map((application) => (
                <EvaluationRow
                  key={application.id}
                  application={application}
                  onEvaluated={handleEvaluated}
                  onScheduled={handleScheduled}
                  tabulation={tabulation.rows.find((row) => row.applicationId === application.id) ?? null}
                  panelists={tabulation.panelists}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
