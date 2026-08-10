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
import { createDashboardRouter } from "@/modules/dashboard/dashboard.routes";
import { createEvaluationCriteriaRouter } from "@/modules/evaluation-criteria/evaluation-criteria.routes";
import { createPanelAssignmentsRouter } from "@/modules/panel-assignments/panel-assignments.routes";
import { createPanelEvaluationsRouter } from "@/modules/panel-evaluations/panel-evaluations.routes";
import { createPositionsRouter } from "@/modules/positions/positions.routes";

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
  app.use("/api/dashboard", createDashboardRouter(container.dashboardController));
  app.use("/api/evaluation-criteria", createEvaluationCriteriaRouter(container.evaluationCriteriaController));
  app.use("/api/panel-assignments", createPanelAssignmentsRouter(container.panelAssignmentsController));
  app.use("/api/panel-evaluations", createPanelEvaluationsRouter(container.panelEvaluationsController));
  app.use("/api/positions", createPositionsRouter(container.positionsController));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
