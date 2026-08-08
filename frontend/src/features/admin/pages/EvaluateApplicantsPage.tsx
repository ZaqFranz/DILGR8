import { useEffect, useRef, useState } from "react";
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

const EMPTY_TABULATION: TabulationResult = { panelists: [], rows: [] };

export function EvaluateApplicantsPage() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [selectedPostingId, setSelectedPostingId] = useState<string>("");
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [tabulation, setTabulation] = useState<TabulationResult>(EMPTY_TABULATION);
  const [loadingPostings, setLoadingPostings] = useState(true);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ExamScoreImportResult | null>(null);
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

  function handleSifted(updated: AdminApplication) {
    setApplications((prev) => prev.map((app) => (app.id === updated.id ? updated : app)));
  }

  function handleScheduled(updated: AdminApplication) {
    setApplications((prev) => prev.map((app) => (app.id === updated.id ? updated : app)));
  }

  async function handleImportExamScores() {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !selectedPostingId) return;
    setError(null);
    setImportResult(null);
    setImporting(true);
    try {
      const result = await importExamScores(selectedPostingId, file);
      setImportResult(result);
      toast.success(`Imported PQE scores: ${result.matched.length} matched, ${result.unmatched.length} unmatched.`);
      const [loadedApplications] = await Promise.all([
        listApplicationsForAdmin(selectedPostingId),
        getTabulation(selectedPostingId).then(setTabulation),
      ]);
      setApplications(loadedApplications);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to import PQE scores");
    } finally {
      setImporting(false);
    }
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

      {selectedPostingId && (
        <div className="card-inset" style={{ marginBottom: "1rem" }}>
          <p className="field-hint">
            Import PQE (Pre-Qualifying Examination) scores from an Excel file (columns "Name" and "Score") - matched
            by name against this posting's Qualified applicants.
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
                    No applications for this posting yet.
                  </td>
                </tr>
              )}
              {applications.map((application) => (
                <EvaluationRow
                  key={application.id}
                  application={application}
                  onSifted={handleSifted}
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
