import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/asyncHandler";
import { authenticate, requireRole } from "@/shared/middleware/authenticate";
import { validate } from "@/shared/validation/validate";
import { idParamSchema } from "@/modules/applicants/applicants.dto";
import type { ApplicantGroupsController } from "./applicant-groups.controller";
import { createApplicantGroupSchema, updateApplicantGroupSchema } from "./applicant-groups.dto";

export function createApplicantGroupsRouter(controller: ApplicantGroupsController): Router {
  const router = Router();
  router.use(authenticate, requireRole("ADMIN"));

  router.get("/", asyncHandler(controller.list));
  router.post("/", validate({ body: createApplicantGroupSchema }), asyncHandler(controller.create));
  router.patch(
    "/:id",
    validate({ params: idParamSchema, body: updateApplicantGroupSchema }),
    asyncHandler(controller.update),
  );
  router.delete("/:id", validate({ params: idParamSchema }), asyncHandler(controller.remove));

  return router;
}
