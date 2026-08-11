import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/asyncHandler";
import { authenticate, requireRole } from "@/shared/middleware/authenticate";
import { validate } from "@/shared/validation/validate";
import { idParamSchema } from "@/modules/applicants/applicants.dto";
import type { ComplianceRequirementsController } from "./compliance-requirements.controller";
import { createComplianceRequirementSchema, updateComplianceRequirementSchema } from "./compliance-requirements.dto";

export function createComplianceRequirementsRouter(controller: ComplianceRequirementsController): Router {
  const router = Router();
  router.use(authenticate);
  router.use(requireRole("ADMIN"));

  router.get("/", asyncHandler(controller.list));
  router.post("/", validate({ body: createComplianceRequirementSchema }), asyncHandler(controller.create));
  router.patch(
    "/:id",
    validate({ params: idParamSchema, body: updateComplianceRequirementSchema }),
    asyncHandler(controller.update),
  );
  router.delete("/:id", validate({ params: idParamSchema }), asyncHandler(controller.remove));

  return router;
}
