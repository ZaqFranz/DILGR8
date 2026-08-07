import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "@/config/env";
import { logger } from "@/shared/logging/logger";
import { errorHandler, notFoundHandler } from "@/shared/middleware/errorHandler";
import { container } from "@/container";
import { createAuthRouter } from "@/modules/auth/auth.routes";
import { createApplicantsRouter } from "@/modules/applicants/applicants.routes";
import { createJobPostingsRouter } from "@/modules/job-postings/job-postings.routes";
import { createApplicationsRouter } from "@/modules/applications/applications.routes";
import { createUsersRouter } from "@/modules/users/users.routes";
import { createAuditLogsRouter } from "@/modules/audit-logs/audit-logs.routes";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()) }));
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/auth", createAuthRouter(container.authController));
  app.use("/api/applicants", createApplicantsRouter(container.applicantsController, container.documentsController));
  app.use("/api/job-postings", createJobPostingsRouter(container.jobPostingsController));
  app.use("/api/applications", createApplicationsRouter(container.applicationsController));
  app.use("/api/users", createUsersRouter(container.usersController));
  app.use("/api/audit-logs", createAuditLogsRouter(container.auditLogsController));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
