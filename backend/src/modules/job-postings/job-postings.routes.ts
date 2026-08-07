import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/asyncHandler";
import { authenticate, requireRole } from "@/shared/middleware/authenticate";
import { validate } from "@/shared/validation/validate";
import { idParamSchema } from "@/modules/applicants/applicants.dto";
import type { JobPostingsController } from "./job-postings.controller";
import { createJobPostingSchema, listJobPostingsQuerySchema, updateJobPostingSchema } from "./job-postings.dto";

export function createJobPostingsRouter(controller: JobPostingsController): Router {
  const router = Router();

  // Public listing so applicants can browse open postings before/without login.
  router.get("/", validate({ query: listJobPostingsQuerySchema }), asyncHandler(controller.list));
  router.get("/:id", validate({ params: idParamSchema }), asyncHandler(controller.getById));

  router.post(
    "/",
    authenticate,
    requireRole("ADMIN"),
    validate({ body: createJobPostingSchema }),
    asyncHandler(controller.create),
  );
  router.patch(
    "/:id",
    authenticate,
    requireRole("ADMIN"),
    validate({ params: idParamSchema, body: updateJobPostingSchema }),
    asyncHandler(controller.update),
  );
  router.delete(
    "/:id",
    authenticate,
    requireRole("ADMIN"),
    validate({ params: idParamSchema }),
    asyncHandler(controller.remove),
  );

  return router;
}
