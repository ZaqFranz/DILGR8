import type { AuditLog, PrismaClient } from "@prisma/client";

export interface RecordAuditLogInput {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: string;
}

export type AuditLogWithActor = AuditLog & { actor: { email: string } | null };

/**
 * Write side is deliberately just `record` (insert-only, no update/delete
 * method exists) - other modules' services depend on this repository
 * directly to append entries, the same way they'd depend on `logger` for
 * process logs. See docs/decisions.md for why the audit trail has no
 * mutation path at all, not even an admin-only one.
 */
export class AuditLogsRepository {
  constructor(private readonly db: PrismaClient) {}

  record(input: RecordAuditLogInput): Promise<AuditLog> {
    return this.db.auditLog.create({ data: input });
  }

  findMany(filters: { entityType?: string }, limit: number): Promise<AuditLogWithActor[]> {
    return this.db.auditLog.findMany({
      where: filters.entityType ? { entityType: filters.entityType } : undefined,
      include: { actor: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
