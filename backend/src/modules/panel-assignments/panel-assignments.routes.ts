import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/asyncHandler";
import { authenticate, requireRole } from "@/shared/middleware/authenticate";
import { validate } from "@/shared/validation/validate";
import { idParamSchema } from "@/modules/applicants/applicants.dto";
import type { PanelAssignmentsController } from "./panel-assignments.controller";
import { createPanelAssignmentSchema, listPanelAssignmentsQuerySchema } from "./panel-assignments.dto";

export function createPanelAssignmentsRouter(controller: PanelAssignmentsController): Router {
  const router = Router();
  router.use(authenticate, requireRole("ADMIN"));

  router.get("/", validate({ query: listPanelAssignmentsQuerySchema }), asyncHandler(controller.list));
  router.post("/", validate({ body: createPanelAssignmentSchema }), asyncHandler(controller.create));
  router.delete("/:id", validate({ params: idParamSchema }), asyncHandler(controller.remove));

  return router;
}
