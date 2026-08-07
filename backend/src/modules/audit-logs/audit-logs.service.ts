import type { AuditLogsRepository, AuditLogWithActor } from "./audit-logs.repository";
import type { ListAuditLogsQueryDto } from "./audit-logs.dto";

export class AuditLogsService {
  constructor(private readonly auditLogsRepository: AuditLogsRepository) {}

  list(query: ListAuditLogsQueryDto): Promise<AuditLogWithActor[]> {
    return this.auditLogsRepository.findMany({ entityType: query.entityType }, query.limit);
  }
}
