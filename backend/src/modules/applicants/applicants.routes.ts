import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/asyncHandler";
import { authenticate } from "@/shared/middleware/authenticate";
import { validate } from "@/shared/validation/validate";
import type { ApplicantsController } from "./applicants.controller";
import {
  createApplicantProfileSchema,
  createAwardSchema,
  createLdInterventionSchema,
  createWorkExperienceSchema,
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
    "/me/work-experiences",
    validate({ body: createWorkExperienceSchema }),
    asyncHandler(controller.addWorkExperience),
  );
  router.delete(
    "/me/work-experiences/:id",
    validate({ params: idParamSchema }),
    asyncHandler(controller.removeWorkExperience),
  );

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

  return router;
}
