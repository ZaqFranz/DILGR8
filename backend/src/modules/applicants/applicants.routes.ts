import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/asyncHandler";
import { authenticate, requireRole } from "@/shared/middleware/authenticate";
import { validate } from "@/shared/validation/validate";
import type { ApplicantsController } from "./applicants.controller";
import {
  createApplicantProfileSchema,
  createAwardSchema,
  createLdInterventionSchema,
  idParamSchema,
  updateApplicantProfileSchema,
} from "./applicants.dto";
import type { DocumentsController } from "./documents/documents.controller";
import { uploadSingleDocument } from "./documents/documents.upload";

export function createApplicantsRouter(controller: ApplicantsController, documentsController: DocumentsController): Router {
  const router = Router();
  router.use(authenticate);

  router.get("/me", asyncHandler(controller.getMyProfile));
  router.post("/me", validate({ body: createApplicantProfileSchema }), asyncHandler(controller.createProfile));
  router.patch("/me", validate({ body: updateApplicantProfileSchema }), asyncHandler(controller.updateProfile));
  router.post("/me/complete-registration", asyncHandler(controller.completeRegistration));

  router.post(
    "/me/ld-interventions",
    validate({ body: createLdInterventionSchema }),
    asyncHandler(controller.addLdIntervention),
  );
  router.delete(
    "/me/ld-interventions/:id",
    validate({ params: idParamSchema }),
    asyncHandler(controller.removeLdIntervention),
  );

  router.post("/me/awards", validate({ body: createAwardSchema }), asyncHandler(controller.addAward));
  router.delete("/me/awards/:id", validate({ params: idParamSchema }), asyncHandler(controller.removeAward));

  router.post("/me/documents", uploadSingleDocument, asyncHandler(documentsController.upload));
  router.get("/me/documents", asyncHandler(documentsController.listMine));
  router.delete("/me/documents/:id", validate({ params: idParamSchema }), asyncHandler(documentsController.remove));

  // Admin and panel: viewing a specific applicant's uploaded documents
  // (admin's "View Documents" modal gets the full set; panel gets PDS-only,
  // scoped in the service to applicants on their assigned interview boards).
  // Registered after /me/documents above so a literal "/me/documents"
  // request is never swallowed by the wildcard ":id" here.
  router.get(
    "/:id/documents",
    requireRole("ADMIN", "PANEL"),
    validate({ params: idParamSchema }),
    asyncHandler(documentsController.listForApplicant),
  );
  router.get(
    "/documents/:id/file",
    requireRole("ADMIN", "PANEL"),
    validate({ params: idParamSchema }),
    asyncHandler(documentsController.viewFile),
  );

  return router;
}
