import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { ValidationError } from "@/shared/errors/AppError";

interface ValidationSchemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

/**
 * Validation layer: parses/coerces req.body|params|query against Zod
 * schemas before the request reaches a controller. On failure, throws a
 * ValidationError (400) with field-level details instead of letting bad
 * input reach the service layer.
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        throw new ValidationError("Invalid request body", result.error.flatten());
      }
      req.body = result.data;
    }
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        throw new ValidationError("Invalid request params", result.error.flatten());
      }
      req.params = result.data;
    }
    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        throw new ValidationError("Invalid query string", result.error.flatten());
      }
      req.query = result.data;
    }
    next();
  };
}
