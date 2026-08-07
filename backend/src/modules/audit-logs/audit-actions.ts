/** Known action/entityType strings written to AuditLog. The column itself
 * is a plain string (not a DB enum) so new action types don't need a
 * migration - these constants just keep call sites from hand-typing them. */
export const AuditAction = {
  USER_CREATED: "USER_CREATED",
  USER_UPDATED: "USER_UPDATED",
  USER_DELETED: "USER_DELETED",
  JOB_POSTING_CREATED: "JOB_POSTING_CREATED",
  JOB_POSTING_UPDATED: "JOB_POSTING_UPDATED",
  JOB_POSTING_DELETED: "JOB_POSTING_DELETED",
  APPLICATION_EVALUATED: "APPLICATION_EVALUATED",
} as const;

export const AuditEntityType = {
  USER: "User",
  JOB_POSTING: "JobPosting",
  APPLICATION: "Application",
} as const;
