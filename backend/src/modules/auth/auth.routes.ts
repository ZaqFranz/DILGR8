import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/asyncHandler";
import { validate } from "@/shared/validation/validate";
import type { AuthController } from "./auth.controller";
import { loginSchema, registerSchema } from "./auth.dto";

export function createAuthRouter(controller: AuthController): Router {
  const router = Router();

  router.post("/register", validate({ body: registerSchema }), asyncHandler(controller.register));
  router.post("/login", validate({ body: loginSchema }), asyncHandler(controller.login));

  return router;
}
