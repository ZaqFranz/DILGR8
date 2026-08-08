/** "JOB_POSTING_CREATED" -> "Job Posting Created" - used anywhere an AuditLog action is displayed (History of Logs, Dashboard's recent activity). */
export function formatAuditAction(action: string): string {
  return action
    .toLowerCase()
    .split("_")
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
}
