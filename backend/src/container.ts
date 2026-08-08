import { prisma } from "@/shared/db/prismaClient";

import { AuthRepository } from "@/modules/auth/auth.repository";
import { AuthService } from "@/modules/auth/auth.service";
import { AuthController } from "@/modules/auth/auth.controller";

import { ApplicantsRepository } from "@/modules/applicants/applicants.repository";
import { ApplicantsService } from "@/modules/applicants/applicants.service";
import { ApplicantsController } from "@/modules/applicants/applicants.controller";

import { DocumentsRepository } from "@/modules/applicants/documents/documents.repository";
import { DocumentsService } from "@/modules/applicants/documents/documents.service";
import { DocumentsController } from "@/modules/applicants/documents/documents.controller";

import { JobPostingsRepository } from "@/modules/job-postings/job-postings.repository";
import { JobPostingsService } from "@/modules/job-postings/job-postings.service";
import { JobPostingsController } from "@/modules/job-postings/job-postings.controller";

import { ApplicationsRepository } from "@/modules/applications/applications.repository";
import { ApplicationsService } from "@/modules/applications/applications.service";
import { ApplicationsController } from "@/modules/applications/applications.controller";

import { UsersRepository } from "@/modules/users/users.repository";
import { UsersService } from "@/modules/users/users.service";
import { UsersController } from "@/modules/users/users.controller";

import { AuditLogsRepository } from "@/modules/audit-logs/audit-logs.repository";
import { AuditLogsService } from "@/modules/audit-logs/audit-logs.service";
import { AuditLogsController } from "@/modules/audit-logs/audit-logs.controller";

import { DashboardRepository } from "@/modules/dashboard/dashboard.repository";
import { DashboardService } from "@/modules/dashboard/dashboard.service";
import { DashboardController } from "@/modules/dashboard/dashboard.controller";

/**
 * Composition root: the one place that wires concrete repositories into
 * services into controllers. Every class up the chain takes its
 * dependencies via constructor injection, so nothing outside this file
 * ever calls `new X()` on a collaborator - swapping an implementation
 * (e.g. a fake repository in tests) only touches this file.
 */
function buildContainer() {
  const applicantsRepository = new ApplicantsRepository(prisma);
  const documentsRepository = new DocumentsRepository(prisma);
  const jobPostingsRepository = new JobPostingsRepository(prisma);
  const applicationsRepository = new ApplicationsRepository(prisma);
  const authRepository = new AuthRepository(prisma);
  const usersRepository = new UsersRepository(prisma);
  const auditLogsRepository = new AuditLogsRepository(prisma);
  const dashboardRepository = new DashboardRepository(prisma);

  const authService = new AuthService(authRepository);
  const applicantsService = new ApplicantsService(applicantsRepository, documentsRepository);
  const documentsService = new DocumentsService(documentsRepository, applicantsRepository, prisma);
  const jobPostingsService = new JobPostingsService(jobPostingsRepository, auditLogsRepository);
  const applicationsService = new ApplicationsService(
    applicationsRepository,
    applicantsRepository,
    jobPostingsRepository,
    documentsRepository,
    auditLogsRepository,
  );
  const usersService = new UsersService(usersRepository, auditLogsRepository);
  const auditLogsService = new AuditLogsService(auditLogsRepository);
  const dashboardService = new DashboardService(dashboardRepository, auditLogsRepository);

  return {
    authController: new AuthController(authService),
    applicantsController: new ApplicantsController(applicantsService),
    documentsController: new DocumentsController(documentsService),
    jobPostingsController: new JobPostingsController(jobPostingsService),
    applicationsController: new ApplicationsController(applicationsService),
    usersController: new UsersController(usersService),
    auditLogsController: new AuditLogsController(auditLogsService),
    dashboardController: new DashboardController(dashboardService),
  };
}

export const container = buildContainer();
export type Container = typeof container;
