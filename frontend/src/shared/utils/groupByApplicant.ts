/**
 * Groups rows by a key (an applicant id, typically), preserving the order
 * each key was first seen in - not sorted, since callers already control
 * row order upstream (e.g. submittedAt) and re-sorting here would silently
 * override that. Generic over the row shape so both the admin Evaluate
 * Applicants table (`AdminApplication[]`, keyed by `row.applicant.id`) and
 * Report Summary/Applicant Scores (`ApplicantScoreRow[]`, keyed by
 * `row.applicantId`) can share one implementation instead of two
 * near-identical grouping loops.
 */
export function groupByApplicant<T>(rows: T[], keyFn: (row: T) => string): { key: string; rows: T[] }[] {
  const order: string[] = [];
  const byKey = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyFn(row);
    const existing = byKey.get(key);
    if (existing) {
      existing.push(row);
    } else {
      byKey.set(key, [row]);
      order.push(key);
    }
  }
  return order.map((key) => ({ key, rows: byKey.get(key)! }));
}
