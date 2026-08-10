import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/asyncHandler";
import { authenticate, requireRole } from "@/shared/middleware/authenticate";
import { validate } from "@/shared/validation/validate";
import { idParamSchema } from "@/modules/applicants/applicants.dto";
import type { PositionsController } from "./positions.controller";
import { createPositionSchema, updatePositionSchema } from "./positions.dto";

export function createPositionsRouter(controller: PositionsController): Router {
  const router = Router();
  router.use(authenticate, requireRole("ADMIN"));

  router.get("/", asyncHandler(controller.list));
  router.post("/", validate({ body: createPositionSchema }), asyncHandler(controller.create));
  router.patch(
    "/:id",
    validate({ params: idParamSchema, body: updatePositionSchema }),
    asyncHandler(controller.update),
  );
  router.delete("/:id", validate({ params: idParamSchema }), asyncHandler(controller.remove));

  return router;
}
