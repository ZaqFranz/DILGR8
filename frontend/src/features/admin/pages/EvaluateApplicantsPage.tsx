import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { listJobPostings } from "@/features/job-postings/api/jobPostingsApi";
import type { JobPosting } from "@/features/job-postings/types";
import { importExamScores, listApplicationsForAdmin } from "../api/adminApplicationsApi";
import { getTabulation } from "../api/panelEvaluationsApi";
import { EvaluationRow } from "../components/EvaluationRow";
import { AdminShell } from "../components/AdminShell";
import type { AdminApplication, ExamScoreImportResult, TabulationResult } from "../types";

function matchesSearch(application: AdminApplication, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;
  const name = `${application.applicant.firstName} ${application.applicant.lastName}`.toLowerCase();
  return name.includes(term) || application.applicant.user.email.toLowerCase().includes(term);
}

export function EvaluateApplicantsPage() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [tabulationByPosting, setTabulationByPosting] = useState<Record<string, TabulationResult>>({});
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ExamScoreImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobTitleFilter, setJobTitleFilter] = useState("");
  const [search, setSearch] = useState("");

  const loadAll = useCallback(async () => {
    const [loadedPostings, loadedApplications] = await Promise.all([listJobPostings(), listApplicationsForAdmin()]);
    setPostings(loadedPostings);
    setApplications(loadedApplications);

    const distinctPostingIds = [...new Set(loadedApplications.map((app) => app.jobPosting.id))];
    const tabulations = await Promise.all(distinctPostingIds.map((id) => getTabulation(id)));
    const map: Record<string, TabulationResult> = {};
    distinctPostingIds.forEach((id, i) => {
      map[id] = tabulations[i]!;
    });
    setTabulationByPosting(map);
  }, []);

  useEffect(() => {
    loadAll()
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load applicants"))
      .finally(() => setLoading(false));
  }, [loadAll]);

  function handleSifted(updated: AdminApplication) {
    setApplications((prev) => prev.map((app) => (app.id === updated.id ? updated : app)));
  }

  function handleScheduled(updated: AdminApplication) {
    setApplications((prev) => prev.map((app) => (app.id === updated.id ? updated : app)));
  }

  async function handleImportExamScores() {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !jobTitleFilter) return;
    setError(null);
    setImportResult(null);
    setImporting(true);
    try {
      const result = await importExamScores(jobTitleFilter, file);
      setImportResult(result);
      toast.success(`Imported PQE scores: ${result.matched.length} matched, ${result.unmatched.length} unmatched.`);
      await loadAll();
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to import PQE scores");
    } finally {
      setImporting(false);
    }
  }

  const filteredApplications = applications.filter(
    (app) => (jobTitleFilter === "" || app.jobPosting.id === jobTitleFilter) && matchesSearch(app, search),
  );

  if (loading) {
    return (
      <AdminShell>
        <LoadingBlock label="Loading applicants..." />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <h1>Evaluate Applicants</h1>
      <ErrorBanner message={error} />

      {postings.length === 0 && <p>No job postings exist yet. Post one first.</p>}

      {postings.length > 0 && (
        <>
          <div className="filters-row">
            <div className="field">
              <label htmlFor="search">Search</label>
              <input
                id="search"
                type="search"
                placeholder="Search by applicant name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="job-title-filter">Job title</label>
              <select id="job-title-filter" value={jobTitleFilter} onChange={(e) => setJobTitleFilter(e.target.value)}>
                <option value="">All job postings</option>
                {postings.map((posting) => (
                  <option key={posting.id} value={posting.id}>
                    {posting.title} ({posting.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {jobTitleFilter ? (
            <div className="card-inset" style={{ marginBottom: "1rem" }}>
              <p className="field-hint">
                Import PQE (Pre-Qualifying Examination) scores from an Excel file (columns "Name" and "Score") -
                matched by name against this posting's Qualified applicants.
              </p>
              <div className="data-table-actions">
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" disabled={importing} />
                <button type="button" className="secondary" disabled={importing} onClick={handleImportExamScores}>
                  {importing && <Spinner size="sm" />}
                  {importing ? "Importing..." : "Import PQE Scores"}
                </button>
              </div>
              {importResult && importResult.unmatched.length > 0 && (
                <div className="field-warning">
                  <p>Could not match {importResult.unmatched.length} row(s) to a Qualified applicant:</p>
                  <ul>
                    {importResult.unmatched.map((row, i) => (
                      <li key={i}>
                        {row.name} — {row.score}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="field-hint" style={{ marginBottom: "1rem" }}>
              Select a specific job title above to import PQE scores for that posting.
            </p>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Email</th>
                  <th>Job Posting</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Exam Score</th>
                  <th>Panel Avg</th>
                  <th>Rank</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {applications.length === 0 && (
                  <tr>
                    <td colSpan={9} className="table-empty">
                      No applications submitted yet.
                    </td>
                  </tr>
                )}
                {applications.length > 0 && filteredApplications.length === 0 && (
                  <tr>
                    <td colSpan={9} className="table-empty">
                      No applicants match your search/filter.
                    </td>
                  </tr>
                )}
                {filteredApplications.map((application) => (
                  <EvaluationRow
                    key={application.id}
                    application={application}
                    onSifted={handleSifted}
                    onScheduled={handleScheduled}
                    tabulation={
                      tabulationByPosting[application.jobPosting.id]?.rows.find(
                        (row) => row.applicationId === application.id,
                      ) ?? null
                    }
                    panelists={tabulationByPosting[application.jobPosting.id]?.panelists ?? []}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminShell>
  );
}
