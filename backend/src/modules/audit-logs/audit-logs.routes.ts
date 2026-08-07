import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/asyncHandler";
import { authenticate, requireRole } from "@/shared/middleware/authenticate";
import { validate } from "@/shared/validation/validate";
import type { AuditLogsController } from "./audit-logs.controller";
import { listAuditLogsQuerySchema } from "./audit-logs.dto";

export function createAuditLogsRouter(controller: AuditLogsController): Router {
  const router = Router();
  router.use(authenticate, requireRole("ADMIN"));

  router.get("/", validate({ query: listAuditLogsQuerySchema }), asyncHandler(controller.list));

  return router;
}
