import { useState } from "react";
import type { Category } from "@/features/admin/types";

interface Props {
  categories: Category[];
}

/**
 * Read-only rubric reference for the interview exercise: every active
 * category alongside its individually-scored criteria/questions and their
 * point values, in one place a panelist can check before or during scoring
 * - separate from the per-criterion hints already shown inline on the
 * scoring form in InterviewRow.
 */
export function CriteriaReferencePanel({ categories }: Props) {
  const [open, setOpen] = useState(false);

  if (categories.length === 0) return null;

  return (
    <div className="card">
      <div className="data-table-actions" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Categories &amp; Criteria/Questions</h2>
        <button type="button" className="secondary" onClick={() => setOpen((prev) => !prev)}>
          {open ? "Hide" : "Show"}
        </button>
      </div>
      {open && (
        <div className="field-grid">
          {categories.map((category) => (
            <div key={category.id} className="card-inset">
              <strong>
                {category.name} — {category.weightPercent}% of overall evaluation (raw scoring 0-{category.maxScore})
              </strong>
              {category.criteria.length > 0 ? (
                <ul className="field-hint">
                  {category.criteria.map((criterion) => (
                    <li key={criterion.id}>
                      {criterion.name} (0-{criterion.maxScore})
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="field-hint">No criteria/questions for this category yet.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
