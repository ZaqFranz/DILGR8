import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/shared/middleware/asyncHandler";
import { authenticate, requireRole } from "@/shared/middleware/authenticate";
import { validate } from "@/shared/validation/validate";
import type { PanelEvaluationsController } from "./panel-evaluations.controller";
import { submitPanelEvaluationSchema } from "./panel-evaluations.dto";

const applicationIdParamSchema = z.object({ applicationId: z.string().uuid() });
const jobPostingIdParamSchema = z.object({ jobPostingId: z.string().uuid() });

export function createPanelEvaluationsRouter(controller: PanelEvaluationsController): Router {
  const router = Router();
  router.use(authenticate);

  router.get("/my-queue", requireRole("PANEL"), asyncHandler(controller.myQueue));
  router.patch(
    "/:applicationId",
    requireRole("PANEL"),
    validate({ params: applicationIdParamSchema, body: submitPanelEvaluationSchema }),
    asyncHandler(controller.submit),
  );
  router.get(
    "/tabulation/:jobPostingId",
    requireRole("ADMIN"),
    validate({ params: jobPostingIdParamSchema }),
    asyncHandler(controller.tabulation),
  );

  return router;
}
