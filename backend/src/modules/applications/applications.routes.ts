import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/asyncHandler";
import { authenticate, requireRole } from "@/shared/middleware/authenticate";
import { validate } from "@/shared/validation/validate";
import { idParamSchema } from "@/modules/applicants/applicants.dto";
import type { ApplicationsController } from "./applications.controller";
import { createApplicationSchema, evaluateApplicationSchema, listApplicationsQuerySchema } from "./applications.dto";

export function createApplicationsRouter(controller: ApplicationsController): Router {
  const router = Router();
  router.use(authenticate);

  router.post("/", validate({ body: createApplicationSchema }), asyncHandler(controller.submit));
  router.get("/me", asyncHandler(controller.listMine));

  router.get(
    "/",
    requireRole("ADMIN"),
    validate({ query: listApplicationsQuerySchema }),
    asyncHandler(controller.listForAdmin),
  );
  router.patch(
    "/:id/evaluate",
    requireRole("ADMIN"),
    validate({ params: idParamSchema, body: evaluateApplicationSchema }),
    asyncHandler(controller.evaluate),
  );

  return router;
}
