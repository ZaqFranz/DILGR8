import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/shared/api/apiClient";
import { ErrorBanner } from "@/shared/components/ErrorBanner";
import { LoadingBlock } from "@/shared/components/LoadingBlock";
import { Modal } from "@/shared/components/Modal";
import { Pagination } from "@/shared/components/Pagination";
import { usePagination } from "@/shared/utils/usePagination";
import { combineApplicantRows } from "../utils/combineApplicantRows";
import { getApplicantScoresOverview } from "../api/panelEvaluationsApi";
import type { ApplicantScoreRow, ApplicantScoresOverview } from "../types";

const OVERALL = "overall";

interface Props {
  onClose: () => void;
}

function formatScore(value: number | null): string {
  return value === null ? "-" : Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * Ranks every scored, in-evaluation application by whichever column the
 * admin picks (overall average total, or one specific category's average
 * score) - a display choice, so the sort/rank happens here rather than in
 * the API, which just returns the raw per-category averages.
 */
export function rankRows(rows: ApplicantScoreRow[], rankBy: string): (ApplicantScoreRow & { rank: number | null })[] {
  const valueOf = (row: ApplicantScoreRow): number | null => (rankBy === OVERALL ? row.total : row.perCategory[rankBy] ?? null);
  const sorted = [...rows].sort((a, b) => {
    const aValue = valueOf(a);
    const bValue = valueOf(b);
    if (aValue === null && bValue === null) return 0;
    if (aValue === null) return 1;
    if (bValue === null) return -1;
    return bValue - aValue;
  });
  // Standard competition ranking (1224...): rows with an equal value share a
  // rank, and the next distinct value's rank is its 1-based position in the
  // sorted list - not just "previous rank + 1", which would break ties
  // arbitrarily by array order instead of ranking them the same.
  let previousValue: number | null = null;
  let previousRank = 1;
  return sorted.map((row, index) => {
    const value = valueOf(row);
    if (value === null) return { ...row, rank: null };
    const rank = value === previousValue ? previousRank : index + 1;
    previousValue = value;
    previousRank = rank;
    return { ...row, rank };
  });
}

export function ApplicantScoresModal({ onClose }: Props) {
  const [overview, setOverview] = useState<ApplicantScoresOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rankBy, setRankBy] = useState<string>(OVERALL);

  useEffect(() => {
    let cancelled = false;
    getApplicantScoresOverview()
      .then((result) => {
        if (!cancelled) setOverview(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load applicant scores");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rankedRows = useMemo(() => (overview ? rankRows(combineApplicantRows(overview.rows), rankBy) : []), [overview, rankBy]);
  const pagination = usePagination(rankedRows, 10);

  return (
    <Modal
      open
      extraWide
      title="Applicant Scores"
      onClose={onClose}
      footer={
        <button type="button" className="secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      <p className="field-hint">
        Every applicant with at least one submitted interview score, across all job postings currently in the
        evaluation phase. Ranked by the column below.
      </p>
      <ErrorBanner message={error} />
      {loading && <LoadingBlock label="Loading applicant scores..." />}
      {!loading && overview && overview.rows.length === 0 && <p>No applicants have been scored yet.</p>}
      {!loading && overview && overview.rows.length > 0 && (
        <>
          <div className="field" style={{ maxWidth: 280 }}>
            <label htmlFor="rank-by">Rank by</label>
            <select id="rank-by" value={rankBy} onChange={(e) => setRankBy(e.target.value)}>
              <option value={OVERALL}>Overall total (average)</option>
              {overview.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
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
                    <td>{row.rank ?? "-"}</td>
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
        </>
      )}
    </Modal>
  );
}
