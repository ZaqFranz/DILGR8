import { Fragment, useEffect, useState, type CSSProperties } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { Pagination } from "@/shared/components/Pagination";
import { usePagination } from "@/shared/utils/usePagination";
import { APPLICATION_STATUS_LABELS } from "@/shared/constants/applicationStatus";
import { AdminShell } from "../components/AdminShell";
import { getApplicantScoresOverview } from "../api/panelEvaluationsApi";
import type { ApplicantScoreCriterionColumn, ApplicantScoresOverview, ApplicationStatus } from "../types";

// Report Summary only ever has rows for applications that have been
// interview-scored, so pre-evaluation statuses (SUBMITTED, UNDER_SIFTING)
// can't actually occur here - and per client request, the rejection/
// withdrawal statuses (NOT_QUALIFIED, DISQUALIFIED, WITHDRAWN) are left out
// of the filter's option list too, since "evaluation of applicant starts
// after Under Sifting." A row with one of these five statuses (if it ever
// occurs) still shows under "All statuses" - only the dropdown's choices
// are narrowed, not which rows the report includes.
const STATUS_FILTER_STATUSES: ApplicationStatus[] = [
  "FOR_INTERVIEW",
  "QUALIFIED",
  "FOR_COMPLIANCE",
  "NOT_SELECTED",
  "FOR_OATH_TAKING",
  "HIRED",
];
const STATUS_FILTER_OPTIONS = STATUS_FILTER_STATUSES.map(
  (status) => [status, APPLICATION_STATUS_LABELS[status]] as [ApplicationStatus, string],
);

function formatScore(value: number | null): string {
  return value === null ? "-" : Number.isInteger(value) ? String(value) : value.toFixed(1);
}

// One accent per category, cycled by position - ties a category's group
// header, its own "Score" sub-column, and nothing else (raw criterion cells
// stay neutral) together at a glance without recoloring the whole table.
// Consumed as CSS custom properties by .category-group-header/.score-col in
// index.css, since the actual category count/order is only known at render
// time.
const CATEGORY_ACCENTS = [
  { bg: "var(--color-primary-light)", border: "var(--color-primary)", text: "var(--color-primary)" },
  { bg: "var(--color-success-bg)", border: "var(--color-success-border)", text: "var(--color-success)" },
  { bg: "var(--color-info-bg)", border: "var(--color-info-border)", text: "var(--color-info)" },
  { bg: "var(--color-warning-bg)", border: "var(--color-warning-border)", text: "var(--color-warning)" },
  { bg: "var(--color-danger-bg)", border: "var(--color-danger-border)", text: "var(--color-danger)" },
];

function categoryAccentStyle(index: number): CSSProperties {
  const accent = CATEGORY_ACCENTS[index % CATEGORY_ACCENTS.length];
  return {
    "--rs-accent-bg": accent.bg,
    "--rs-accent-border": accent.border,
    "--rs-accent-text": accent.text,
  } as CSSProperties;
}

// Criteria arrive as one flat, category-grouped list (see
// applicantScoresOverview() on the backend) - re-group them by categoryId so
// the table can render each category's own criteria as CR1, CR2, ... under
// that category's header, independent of every other category's numbering.
function groupCriteriaByCategory(
  criteria: ApplicantScoreCriterionColumn[],
): Map<string, ApplicantScoreCriterionColumn[]> {
  const byCategory = new Map<string, ApplicantScoreCriterionColumn[]>();
  for (const criterion of criteria) {
    const list = byCategory.get(criterion.categoryId);
    if (list) {
      list.push(criterion);
    } else {
      byCategory.set(criterion.categoryId, [criterion]);
    }
  }
  return byCategory;
}

/**
 * Every scored application's combined interview result, by Category and by
 * Criterion, as columns in one table - no prose/breakdown section, just
 * the scores. "Combined" here means the same thing it does everywhere else
 * panel scores are aggregated in this app (see PanelEvaluationsService.
 * applicantScoresOverview()): the average across however many panelists
 * actually scored this application, not a sum and not any one panelist's
 * own number. An admin who needs the per-panelist breakdown instead has
 * that in the CompAss tabulation view (Evaluate Applicants), which this
 * page deliberately doesn't duplicate.
 */
export function ReportSummaryPage() {
  const [overview, setOverview] = useState<ApplicantScoresOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "">("");
  const [publicationFilter, setPublicationFilter] = useState("");

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
  const publicationOptions = [...new Set(rows.map((row) => row.jobPostingPublication))].sort();
  const filteredRows = rows.filter(
    (row) =>
      (statusFilter === "" || row.status === statusFilter) &&
      (publicationFilter === "" || row.jobPostingPublication === publicationFilter),
  );
  const pagination = usePagination(filteredRows, 10);
  const criteriaByCategory = groupCriteriaByCategory(overview?.criteria ?? []);

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
          <div className="filters-row">
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
          {filteredRows.length === 0 && <p>No applicants match the selected filters.</p>}
          {filteredRows.length > 0 && (
            <div className="table-wrap">
              <table className="report-summary-table">
                <thead>
                  <tr>
                    <th rowSpan={2} className="sticky-col">
                      Applicant
                    </th>
                    <th rowSpan={2}>Job posting</th>
                    <th rowSpan={2}>Status</th>
                    {overview.categories.map((category, index) => (
                      <th
                        key={category.id}
                        colSpan={(criteriaByCategory.get(category.id)?.length ?? 0) + 1}
                        className="category-group-header"
                        style={categoryAccentStyle(index)}
                      >
                        {category.name} (0-{category.weightPercent})
                      </th>
                    ))}
                    <th className="total-col">Total (avg)</th>
                    <th className="panelists-col">Panelists submitted</th>
                  </tr>
                  {/* Applicant/Job posting/Status span both header rows (rowSpan above)
                      since they have no sub-column of their own. Total/Panelists
                      submitted don't span - they get an explicit empty cell here instead
                      - so the header's row1/row2 divider line still runs underneath them
                      instead of stopping at the last category column. */}
                  <tr>
                    {overview.categories.map((category, index) => (
                      <Fragment key={category.id}>
                        {(criteriaByCategory.get(category.id) ?? []).map((criterion, criterionIndex) => (
                          <th
                            key={criterion.id}
                            className="criterion-header"
                            title={`${criterion.name} (0-${criterion.maxScore})`}
                          >
                            CR{criterionIndex + 1}
                          </th>
                        ))}
                        <th className="score-col" style={categoryAccentStyle(index)}>
                          Score
                        </th>
                      </Fragment>
                    ))}
                    <th className="total-col" aria-hidden="true" />
                    <th className="panelists-col" aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {pagination.pageItems.map((row) => (
                    <tr key={row.applicationId}>
                      <td className="sticky-col">{row.applicantName}</td>
                      <td>{row.jobPostingTitle}</td>
                      <td>
                        <span className={`badge ${row.status.toLowerCase()}`}>
                          {APPLICATION_STATUS_LABELS[row.status]}
                        </span>
                      </td>
                      {overview.categories.map((category, index) => (
                        <Fragment key={category.id}>
                          {(criteriaByCategory.get(category.id) ?? []).map((criterion) => (
                            <td key={criterion.id}>{formatScore(row.perCriterion[criterion.id] ?? null)}</td>
                          ))}
                          <td className="score-col" style={categoryAccentStyle(index)}>
                            {formatScore(row.perCategory[category.id] ?? null)}
                          </td>
                        </Fragment>
                      ))}
                      <td className="total-col">{formatScore(row.total)}</td>
                      <td className="panelists-col">
                        <span className="panelists-badge">
                          {row.panelistsSubmitted}/{row.panelistsAssigned}
                        </span>
                      </td>
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
          )}
        </>
      )}
    </AdminShell>
  );
}
