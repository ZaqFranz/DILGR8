import { Router } from "express";
import { asyncHandler } from "@/shared/middleware/asyncHandler";
import { authenticate } from "@/shared/middleware/authenticate";
import { validate } from "@/shared/validation/validate";
import type { AuthController } from "./auth.controller";
import { changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema } from "./auth.dto";

export function createAuthRouter(controller: AuthController): Router {
  const router = Router();

  router.post("/register", validate({ body: registerSchema }), asyncHandler(controller.register));
  router.post("/login", validate({ body: loginSchema }), asyncHandler(controller.login));
  router.post(
    "/forgot-password",
    validate({ body: forgotPasswordSchema }),
    asyncHandler(controller.forgotPassword),
  );
  router.patch(
    "/me/password",
    authenticate,
    validate({ body: changePasswordSchema }),
    asyncHandler(controller.changePassword),
  );

  return router;
}
