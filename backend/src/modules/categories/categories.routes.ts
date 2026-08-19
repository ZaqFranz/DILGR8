import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/asyncHandler";
import { authenticate, requireRole } from "@/shared/middleware/authenticate";
import { validate } from "@/shared/validation/validate";
import { idParamSchema } from "@/modules/applicants/applicants.dto";
import type { CategoriesController } from "./categories.controller";
import { createCategorySchema, updateCategorySchema } from "./categories.dto";

export function createCategoriesRouter(controller: CategoriesController): Router {
  const router = Router();
  router.use(authenticate);

  router.get("/", requireRole("ADMIN", "PANEL"), asyncHandler(controller.list));
  router.post("/", requireRole("ADMIN"), validate({ body: createCategorySchema }), asyncHandler(controller.create));
  router.patch(
    "/:id",
    requireRole("ADMIN"),
    validate({ params: idParamSchema, body: updateCategorySchema }),
    asyncHandler(controller.update),
  );
  router.delete("/:id", requireRole("ADMIN"), validate({ params: idParamSchema }), asyncHandler(controller.remove));

  return router;
}
