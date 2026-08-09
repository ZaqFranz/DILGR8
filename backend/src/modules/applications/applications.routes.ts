import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/asyncHandler";
import { authenticate, requireRole } from "@/shared/middleware/authenticate";
import { validate } from "@/shared/validation/validate";
import { idParamSchema } from "@/modules/applicants/applicants.dto";
import type { ApplicationsController } from "./applications.controller";
import {
  listApplicationsQuerySchema,
  scheduleInterviewSchema,
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

  return router;
}
