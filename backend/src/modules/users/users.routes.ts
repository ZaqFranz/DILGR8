import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/asyncHandler";
import { authenticate, requireRole } from "@/shared/middleware/authenticate";
import { validate } from "@/shared/validation/validate";
import { idParamSchema } from "@/modules/applicants/applicants.dto";
import type { UsersController } from "./users.controller";
import { createUserSchema, listUsersQuerySchema, updateUserSchema } from "./users.dto";

export function createUsersRouter(controller: UsersController): Router {
  const router = Router();
  router.use(authenticate, requireRole("ADMIN"));

  router.get("/", validate({ query: listUsersQuerySchema }), asyncHandler(controller.list));
  router.post("/", validate({ body: createUserSchema }), asyncHandler(controller.create));
  router.patch("/:id", validate({ params: idParamSchema, body: updateUserSchema }), asyncHandler(controller.update));
  router.delete("/:id", validate({ params: idParamSchema }), asyncHandler(controller.remove));

  return router;
}
