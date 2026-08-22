import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/asyncHandler";
import { authenticate, requireOwner, requireRole } from "@/shared/middleware/authenticate";
import { validate } from "@/shared/validation/validate";
import { idParamSchema } from "@/modules/applicants/applicants.dto";
import type { HistoricalHiringDataController } from "./historical-hiring-data.controller";
import {
  createHistoricalHiringRecordSchema,
  predictHireQuerySchema,
  updateHistoricalHiringRecordSchema,
} from "./historical-hiring-data.dto";

// Two different gates on purpose: the raw historical corpus (CRUD) is
// requireOwner-only, hidden from every existing role including ADMIN; the
// derived percentage (predict) stays ADMIN-visible, since that's the
// feature that was actually requested on Evaluate Applicants. See
// docs/decisions.md.
export function createHistoricalHiringDataRouter(controller: HistoricalHiringDataController): Router {
  const router = Router();
  router.use(authenticate);

  router.get("/", requireOwner, asyncHandler(controller.list));
  router.post(
    "/",
    requireOwner,
    validate({ body: createHistoricalHiringRecordSchema }),
    asyncHandler(controller.create),
  );
  router.patch(
    "/:id",
    requireOwner,
    validate({ params: idParamSchema, body: updateHistoricalHiringRecordSchema }),
    asyncHandler(controller.update),
  );
  router.delete("/:id", requireOwner, validate({ params: idParamSchema }), asyncHandler(controller.remove));

  router.get(
    "/predict",
    requireRole("ADMIN"),
    validate({ query: predictHireQuerySchema }),
    asyncHandler(controller.predict),
  );

  return router;
}
