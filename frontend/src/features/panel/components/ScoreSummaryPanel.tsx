import { useState } from "react";
import type { Category, InterviewQueueApplication } from "@/features/admin/types";
import { maxWeightedTotal, weightedTotalScore } from "@/shared/utils/weightedScore";

interface Props {
  categories: Category[];
  queue: InterviewQueueApplication[];
}

/**
 * Summary of the scores this panelist has personally submitted so far.
 * `queue` only ever carries the signed-in panelist's own PanelEvaluation
 * (the backend's my-queue endpoint scopes it that way), so this is
 * inherently self-scores-only - no other panelist's marks or the
 * cross-panel average are exposed here. Totals shown are weighted (each
 * category normalized to its own weightPercent), matching what actually
 * counts toward the overall evaluation - not a raw point sum.
 */
export function ScoreSummaryPanel({ categories, queue }: Props) {
  const [open, setOpen] = useState(false);
  const maxTotal = maxWeightedTotal(categories);
  const scored = queue.filter((application) => application.panelEvaluations.length > 0);

  return (
    <div className="card">
      <div className="data-table-actions" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>My Score Summary</h2>
        <button type="button" className="secondary" onClick={() => setOpen((prev) => !prev)}>
          {open ? "Hide" : `Show (${scored.length} scored)`}
        </button>
      </div>
      {open && scored.length === 0 && <p className="field-hint">You haven&apos;t submitted any scores yet.</p>}
      {open && scored.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Job posting</th>
                <th>My total score</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {scored.map((application) => {
                const evaluation = application.panelEvaluations[0];
                const total = weightedTotalScore(categories, evaluation.scores);
                return (
                  <tr key={application.id}>
                    <td>
                      {application.applicant.firstName} {application.applicant.lastName}
                    </td>
                    <td>{application.jobPosting.title}</td>
                    <td>
                      {total.toFixed(1)} / {maxTotal}
                    </td>
                    <td>{new Date(evaluation.submittedAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
