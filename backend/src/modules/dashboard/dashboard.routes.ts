import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/asyncHandler";
import { authenticate, requireRole } from "@/shared/middleware/authenticate";
import type { DashboardController } from "./dashboard.controller";

export function createDashboardRouter(controller: DashboardController): Router {
  const router = Router();
  router.use(authenticate, requireRole("ADMIN"));

  router.get("/summary", asyncHandler(controller.summary));

  return router;
}
