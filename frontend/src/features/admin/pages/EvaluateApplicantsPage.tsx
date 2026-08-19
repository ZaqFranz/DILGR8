import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { Pagination } from "@/shared/components/Pagination";
import { Spinner } from "@/shared/components/Spinner";
import { useToast } from "@/shared/components/ToastProvider";
import { usePagination } from "@/shared/utils/usePagination";
import { APPLICATION_STATUS_LABELS } from "@/shared/constants/applicationStatus";
import { listJobPostings } from "@/features/job-postings/api/jobPostingsApi";
import type { JobPosting } from "@/features/job-postings/types";
import { exportPendingPqeScores, importExamScores, listApplicationsForAdmin } from "../api/adminApplicationsApi";
import { getTabulation } from "../api/panelEvaluationsApi";
import { EvaluationRow } from "../components/EvaluationRow";
import { AdminShell } from "../components/AdminShell";
import type { AdminApplication, ApplicationStatus, ExamScoreImportResult, TabulationResult } from "../types";

const STATUS_FILTER_OPTIONS = Object.entries(APPLICATION_STATUS_LABELS) as [ApplicationStatus, string][];

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
  const [exportingPending, setExportingPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobTitleFilter, setJobTitleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "">("");
  const [publicationFilter, setPublicationFilter] = useState("");
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
    if (!file) return;
    setError(null);
    setImportResult(null);
    setImporting(true);
    try {
      const result = await importExamScores(jobTitleFilter || undefined, file);
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

  async function handleExportPendingPqe() {
    setError(null);
    setExportingPending(true);
    try {
      const blob = await exportPendingPqeScores(jobTitleFilter || undefined);
      const selectedPosting = postings.find((posting) => posting.id === jobTitleFilter);
      const fileName = selectedPosting
        ? `pending-pqe-scores-${selectedPosting.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.xlsx`
        : "pending-pqe-scores-all-jobs.xlsx";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to download pending PQE list");
    } finally {
      setExportingPending(false);
    }
  }

  // Admin-typed free text, not a fixed list - offer whatever values are
  // actually in use right now as filter choices instead of a hardcoded set.
  const publicationOptions = [...new Set(postings.map((posting) => posting.publication))].sort();

  const filteredApplications = applications.filter(
    (app) =>
      (jobTitleFilter === "" || app.jobPosting.id === jobTitleFilter) &&
      (statusFilter === "" || app.status === statusFilter) &&
      (publicationFilter === "" || app.jobPosting.publication === publicationFilter) &&
      matchesSearch(app, search),
  );
  const pagination = usePagination(filteredApplications, 10);

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
                onChange={(e) => {
                  setSearch(e.target.value);
                  pagination.setPage(1);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="job-title-filter">Job title</label>
              <select
                id="job-title-filter"
                value={jobTitleFilter}
                onChange={(e) => {
                  setJobTitleFilter(e.target.value);
                  pagination.setPage(1);
                }}
              >
                <option value="">All job postings</option>
                {postings.map((posting) => (
                  <option key={posting.id} value={posting.id}>
                    {posting.title} ({posting.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="status-filter">Status</label>
              <select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as ApplicationStatus | "");
                  pagination.setPage(1);
                }}
              >
                <option value="">All statuses</option>
                {STATUS_FILTER_OPTIONS.map(([status, label]) => (
                  <option key={status} value={status}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="publication-filter">Publication</label>
              <select
                id="publication-filter"
                value={publicationFilter}
                onChange={(e) => {
                  setPublicationFilter(e.target.value);
                  pagination.setPage(1);
                }}
              >
                <option value="">All publications</option>
                {publicationOptions.map((publication) => (
                  <option key={publication} value={publication}>
                    {publication}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="card-inset" style={{ marginBottom: "1rem" }}>
            <p className="field-hint">
              Download the applicants still waiting for a PQE score{jobTitleFilter ? " for this posting" : " across all job postings"}
              , fill in the Score column, then upload it back below.
            </p>
            <div className="data-table-actions" style={{ marginBottom: "1rem" }}>
              <button type="button" className="secondary" disabled={exportingPending} onClick={handleExportPendingPqe}>
                {exportingPending && <Spinner size="sm" />}
                {exportingPending ? "Downloading..." : "Download Pending PQE List"}
              </button>
            </div>
            {jobTitleFilter ? (
              <p className="field-hint">
                Import PQE (Pre-Qualifying Examination) scores from an Excel file (columns "Name" and "Score") -
                matched by name against this posting's Qualified applicants. A "Job Title" column is ignored here
                since every match is already scoped to this posting.
              </p>
            ) : (
              <p className="field-hint">
                Import PQE scores across all job postings at once from an Excel file (columns "Name", "Score", and
                "Job Title") - matched by name <em>and</em> job title against every Qualified applicant, since the
                same name can be Qualified on more than one posting. Add the job title column to align each row to
                the right posting.
              </p>
            )}
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
                      {row.name}
                      {row.jobTitle ? ` (${row.jobTitle})` : ""} — {row.score}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Applicant</th>
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
                    <td colSpan={8} className="table-empty">
                      No applications submitted yet.
                    </td>
                  </tr>
                )}
                {applications.length > 0 && filteredApplications.length === 0 && (
                  <tr>
                    <td colSpan={8} className="table-empty">
                      No applicants match your search/filter.
                    </td>
                  </tr>
                )}
                {pagination.pageItems.map((application) => (
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
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              pageSize={10}
              onPageChange={pagination.setPage}
            />
          </div>
        </>
      )}
    </AdminShell>
  );
}
