import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/asyncHandler";
import { authenticate, requireRole } from "@/shared/middleware/authenticate";
import { validate } from "@/shared/validation/validate";
import { idParamSchema } from "@/modules/applicants/applicants.dto";
import type { ApplicationsController } from "./applications.controller";
import {
  applicationComplianceItemParamSchema,
  listApplicationsQuerySchema,
  reviewComplianceItemSchema,
  scheduleInterviewSchema,
  scheduleOathTakingSchema,
  setExamScoreSchema,
  siftApplicationSchema,
} from "./applications.dto";
import { uploadExamScoreFile } from "./examScoreImport.upload";
import { uploadApplicationLetter } from "./applicationLetter.upload";

export function createApplicationsRouter(controller: ApplicationsController): Router {
  const router = Router();
  router.use(authenticate);

  router.post("/", uploadApplicationLetter, asyncHandler(controller.submit));
  router.get("/me", asyncHandler(controller.listMine));
  router.patch("/:id/withdraw", validate({ params: idParamSchema }), asyncHandler(controller.withdraw));
  // No requireRole - an APPLICANT may only read their own application's
  // checklist (enforced in the service), an ADMIN may read any.
  router.get(
    "/:id/compliance-items",
    validate({ params: idParamSchema }),
    asyncHandler(controller.listComplianceItems),
  );

  router.get(
    "/",
    requireRole("ADMIN"),
    validate({ query: listApplicationsQuerySchema }),
    asyncHandler(controller.listForAdmin),
  );
  router.patch(
    "/:id/sift",
    requireRole("ADMIN"),
    validate({ params: idParamSchema, body: siftApplicationSchema }),
    asyncHandler(controller.sift),
  );
  router.get(
    "/pending-pqe-export",
    requireRole("ADMIN"),
    validate({ query: listApplicationsQuerySchema }),
    asyncHandler(controller.exportPendingPqeScores),
  );
  router.post(
    "/import-exam-scores",
    requireRole("ADMIN"),
    uploadExamScoreFile,
    asyncHandler(controller.importExamScores),
  );
  router.patch(
    "/:id/exam-score",
    requireRole("ADMIN"),
    validate({ params: idParamSchema, body: setExamScoreSchema }),
    asyncHandler(controller.setExamScore),
  );
  router.patch(
    "/:id/schedule-interview",
    requireRole("ADMIN"),
    validate({ params: idParamSchema, body: scheduleInterviewSchema }),
    asyncHandler(controller.scheduleInterview),
  );
  router.patch(
    "/:id/move-to-compliance",
    requireRole("ADMIN"),
    validate({ params: idParamSchema }),
    asyncHandler(controller.moveToCompliance),
  );
  router.patch(
    "/:id/compliance-items/:itemId",
    requireRole("ADMIN"),
    validate({ params: applicationComplianceItemParamSchema, body: reviewComplianceItemSchema }),
    asyncHandler(controller.reviewComplianceItem),
  );
  router.patch(
    "/:id/oath-taking",
    requireRole("ADMIN"),
    validate({ params: idParamSchema, body: scheduleOathTakingSchema }),
    asyncHandler(controller.scheduleOathTaking),
  );
  router.patch(
    "/:id/hire",
    requireRole("ADMIN"),
    validate({ params: idParamSchema }),
    asyncHandler(controller.markHired),
  );

  return router;
}
