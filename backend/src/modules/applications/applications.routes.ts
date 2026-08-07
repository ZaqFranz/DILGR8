import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/asyncHandler";
import { authenticate } from "@/shared/middleware/authenticate";
import { validate } from "@/shared/validation/validate";
import type { ApplicationsController } from "./applications.controller";
import { createApplicationSchema } from "./applications.dto";

export function createApplicationsRouter(controller: ApplicationsController): Router {
  const router = Router();
  router.use(authenticate);

  router.post("/", validate({ body: createApplicationSchema }), asyncHandler(controller.submit));
  router.get("/me", asyncHandler(controller.listMine));

  return router;
}
