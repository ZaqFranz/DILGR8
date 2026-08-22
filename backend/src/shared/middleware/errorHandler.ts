import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { Prisma } from "@prisma/client";
import { AppError } from "@/shared/errors/AppError";
import { logger } from "@/shared/logging/logger";

/**
 * Single place where every error thrown anywhere in the request lifecycle
 * is translated into an HTTP response. Keeps controllers/services free of
 * try/catch-and-format boilerplate (they just `throw`).
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path }, err.message);
    }
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({ error: { code: "CONFLICT", message: "Record already exists" } });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Record not found" } });
      return;
    }
  }

  if (err instanceof MulterError) {
    res.status(400).json({ error: { code: "UPLOAD_ERROR", message: err.message } });
    return;
  }

  // express.json() throws a SyntaxError (with .status/.statusCode 400 set
  // by body-parser) when the request body isn't valid JSON - map it to a
  // real 400 instead of falling through to the generic 500 below.
  if (err instanceof SyntaxError && "status" in err && (err as { status?: unknown }).status === 400) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Malformed JSON in request body" } });
    return;
  }

  logger.error({ err, path: req.path }, "Unhandled error");
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.path} not found` } });
}
