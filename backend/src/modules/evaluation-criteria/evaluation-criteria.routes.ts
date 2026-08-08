import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/asyncHandler";
import { authenticate, requireRole } from "@/shared/middleware/authenticate";
import { validate } from "@/shared/validation/validate";
import { idParamSchema } from "@/modules/applicants/applicants.dto";
import type { EvaluationCriteriaController } from "./evaluation-criteria.controller";
import { createEvaluationCriterionSchema, updateEvaluationCriterionSchema } from "./evaluation-criteria.dto";

export function createEvaluationCriteriaRouter(controller: EvaluationCriteriaController): Router {
  const router = Router();
  router.use(authenticate);

  router.get("/", requireRole("ADMIN", "PANEL"), asyncHandler(controller.list));
  router.post("/", requireRole("ADMIN"), validate({ body: createEvaluationCriterionSchema }), asyncHandler(controller.create));
  router.patch(
    "/:id",
    requireRole("ADMIN"),
    validate({ params: idParamSchema, body: updateEvaluationCriterionSchema }),
    asyncHandler(controller.update),
  );
  router.delete("/:id", requireRole("ADMIN"), validate({ params: idParamSchema }), asyncHandler(controller.remove));

  return router;
}
