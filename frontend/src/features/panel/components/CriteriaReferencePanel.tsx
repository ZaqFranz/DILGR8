import { useState } from "react";
import type { EvaluationCriterion } from "@/features/admin/types";

interface Props {
  criteria: EvaluationCriterion[];
}

/**
 * Read-only rubric reference for the interview exercise: every active
 * criterion alongside its guiding questions, in one place a panelist can
 * check before or during scoring - separate from the per-criterion hints
 * already shown inline on the scoring form in InterviewRow.
 */
export function CriteriaReferencePanel({ criteria }: Props) {
  const [open, setOpen] = useState(false);

  if (criteria.length === 0) return null;

  return (
    <div className="card">
      <div className="data-table-actions" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Evaluation Criteria &amp; Guiding Questions</h2>
        <button type="button" className="secondary" onClick={() => setOpen((prev) => !prev)}>
          {open ? "Hide" : "Show"}
        </button>
      </div>
      {open && (
        <div className="field-grid">
          {criteria.map((criterion) => (
            <div key={criterion.id} className="card-inset">
              <strong>
                {criterion.name} (0-{criterion.maxScore})
              </strong>
              {criterion.questions.length > 0 ? (
                <ul className="field-hint">
                  {criterion.questions.map((question) => (
                    <li key={question.id}>{question.text}</li>
                  ))}
                </ul>
              ) : (
                <p className="field-hint">No guiding questions for this criterion.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
