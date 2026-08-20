import { useEffect, useState } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { Pagination } from "@/shared/components/Pagination";
import { usePagination } from "@/shared/utils/usePagination";
import { AdminShell } from "../components/AdminShell";
import { getApplicantScoresOverview } from "../api/panelEvaluationsApi";
import type { ApplicantScoresOverview } from "../types";

function formatScore(value: number | null): string {
  return value === null ? "-" : Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * Every scored application's combined interview result, by Category and,
 * always shown alongside it (no expand/collapse - per client follow-up,
 * the breakdown itself stays, only the toggle interaction was unwanted),
 * by Criterion - never broken down by individual panelist. "Combined" here
 * means the same thing it does everywhere else panel scores are aggregated
 * in this app (see PanelEvaluationsService.applicantScoresOverview()): the
 * average across however many panelists actually scored this application,
 * not a sum and not any one panelist's own number. An admin who needs the
 * per-panelist breakdown instead has that in the CompAss tabulation view
 * (Evaluate Applicants), which this page deliberately doesn't duplicate.
 */
export function ReportSummaryPage() {
  const [overview, setOverview] = useState<ApplicantScoresOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getApplicantScoresOverview()
      .then((result) => {
        if (!cancelled) setOverview(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load report summary");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = overview?.rows ?? [];
  const pagination = usePagination(rows, 10);

  return (
    <AdminShell>
      <div className="page-header">
        <h1>Report Summary</h1>
      </div>
      <p>
        Every scored application&apos;s combined interview result by Category and Criterion, averaged across
        however many panelists actually scored it. Individual panelist scores aren&apos;t shown here; that
        breakdown lives in Evaluate Applicants&apos; tabulation view.
      </p>
      <ErrorBanner message={error} />

      {loading && <LoadingBlock label="Loading report summary..." />}
      {!loading && rows.length === 0 && <p>No applicants have been scored yet.</p>}
      {!loading && overview && rows.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Job posting</th>
                  {overview.categories.map((category) => (
                    <th key={category.id}>
                      {category.name} (0-{category.weightPercent})
                    </th>
                  ))}
                  <th>Total (avg)</th>
                  <th>Panelists submitted</th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageItems.map((row) => (
                  <tr key={row.applicationId}>
                    <td>{row.applicantName}</td>
                    <td>{row.jobPostingTitle}</td>
                    {overview.categories.map((category) => (
                      <td key={category.id}>{formatScore(row.perCategory[category.id] ?? null)}</td>
                    ))}
                    <td>{formatScore(row.total)}</td>
                    <td>{row.panelistsSubmitted}</td>
                  </tr>
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

          {pagination.pageItems.map((row) => (
            <div key={row.applicationId} className="card" style={{ marginTop: "1rem" }}>
              <h2 style={{ marginTop: 0 }}>
                {row.applicantName}: {row.jobPostingTitle}
              </h2>
              <div className="field-grid">
                {overview.categories.map((category) => (
                  <div key={category.id} className="card-inset">
                    <strong>
                      {category.name}: {formatScore(row.perCategory[category.id] ?? null)} of {category.weightPercent}
                    </strong>
                    {overview.criteria.filter((criterion) => criterion.categoryId === category.id).length === 0 ? (
                      <p className="field-hint">No criteria/questions in this category.</p>
                    ) : (
                      <ul className="field-hint">
                        {overview.criteria
                          .filter((criterion) => criterion.categoryId === category.id)
                          .map((criterion) => (
                            <li key={criterion.id}>
                              {criterion.name}: {formatScore(row.perCriterion[criterion.id] ?? null)} (0-
                              {criterion.maxScore})
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </AdminShell>
  );
}
