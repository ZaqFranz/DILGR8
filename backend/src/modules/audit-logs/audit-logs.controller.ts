import type { Request, Response } from "express";
import type { AuditLogsService } from "./audit-logs.service";
import type { ListAuditLogsQueryDto } from "./audit-logs.dto";

export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const logs = await this.auditLogsService.list(req.query as unknown as ListAuditLogsQueryDto);
    res.status(200).json(logs);
  };
}
