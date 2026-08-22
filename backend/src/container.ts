import { prisma } from "@/shared/db/prismaClient";
import { EmailService } from "@/shared/email/emailService";

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

import { CategoriesRepository } from "@/modules/categories/categories.repository";
import { CategoriesService } from "@/modules/categories/categories.service";
import { CategoriesController } from "@/modules/categories/categories.controller";

import { PanelAssignmentsRepository } from "@/modules/panel-assignments/panel-assignments.repository";
import { PanelAssignmentsService } from "@/modules/panel-assignments/panel-assignments.service";
import { PanelAssignmentsController } from "@/modules/panel-assignments/panel-assignments.controller";

import { PanelEvaluationsRepository } from "@/modules/panel-evaluations/panel-evaluations.repository";
import { PanelEvaluationsService } from "@/modules/panel-evaluations/panel-evaluations.service";
import { PanelEvaluationsController } from "@/modules/panel-evaluations/panel-evaluations.controller";

import { PositionsRepository } from "@/modules/positions/positions.repository";
import { PositionsService } from "@/modules/positions/positions.service";
import { PositionsController } from "@/modules/positions/positions.controller";

import { ComplianceRequirementsRepository } from "@/modules/compliance-requirements/compliance-requirements.repository";
import { ComplianceItemsRepository } from "@/modules/compliance-requirements/compliance-items.repository";
import { ComplianceRequirementsService } from "@/modules/compliance-requirements/compliance-requirements.service";
import { ComplianceRequirementsController } from "@/modules/compliance-requirements/compliance-requirements.controller";

import { ApplicantGroupsRepository } from "@/modules/applicant-groups/applicant-groups.repository";
import { ApplicantGroupsService } from "@/modules/applicant-groups/applicant-groups.service";
import { ApplicantGroupsController } from "@/modules/applicant-groups/applicant-groups.controller";

import { HistoricalHiringDataRepository } from "@/modules/historical-hiring-data/historical-hiring-data.repository";
import { HistoricalHiringDataService } from "@/modules/historical-hiring-data/historical-hiring-data.service";
import { HistoricalHiringDataController } from "@/modules/historical-hiring-data/historical-hiring-data.controller";

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
  const categoriesRepository = new CategoriesRepository(prisma);
  const panelAssignmentsRepository = new PanelAssignmentsRepository(prisma);
  const panelEvaluationsRepository = new PanelEvaluationsRepository(prisma);
  const positionsRepository = new PositionsRepository(prisma);
  const complianceRequirementsRepository = new ComplianceRequirementsRepository(prisma);
  const complianceItemsRepository = new ComplianceItemsRepository(prisma);
  const applicantGroupsRepository = new ApplicantGroupsRepository(prisma);
  const historicalHiringDataRepository = new HistoricalHiringDataRepository(prisma);
  const emailService = new EmailService();

  const authService = new AuthService(authRepository, auditLogsRepository, emailService);
  const applicantsService = new ApplicantsService(applicantsRepository, documentsRepository);
  const documentsService = new DocumentsService(documentsRepository, applicantsRepository, panelAssignmentsRepository, prisma);
  const jobPostingsService = new JobPostingsService(
    jobPostingsRepository,
    auditLogsRepository,
    positionsRepository,
    panelAssignmentsRepository,
  );
  const applicationsService = new ApplicationsService(
    applicationsRepository,
    applicantsRepository,
    jobPostingsRepository,
    documentsRepository,
    auditLogsRepository,
    emailService,
    complianceItemsRepository,
    complianceRequirementsRepository,
  );
  const usersService = new UsersService(usersRepository, auditLogsRepository, emailService);
  const auditLogsService = new AuditLogsService(auditLogsRepository);
  const dashboardService = new DashboardService(dashboardRepository, auditLogsRepository);
  const categoriesService = new CategoriesService(categoriesRepository, auditLogsRepository);
  const panelAssignmentsService = new PanelAssignmentsService(
    panelAssignmentsRepository,
    jobPostingsRepository,
    usersRepository,
    auditLogsRepository,
  );
  const panelEvaluationsService = new PanelEvaluationsService(
    panelEvaluationsRepository,
    panelAssignmentsRepository,
    categoriesRepository,
    auditLogsRepository,
  );
  const positionsService = new PositionsService(positionsRepository, auditLogsRepository, usersRepository);
  const complianceRequirementsService = new ComplianceRequirementsService(
    complianceRequirementsRepository,
    auditLogsRepository,
  );
  const applicantGroupsService = new ApplicantGroupsService(
    applicantGroupsRepository,
    applicationsRepository,
    auditLogsRepository,
  );
  const historicalHiringDataService = new HistoricalHiringDataService(historicalHiringDataRepository);

  return {
    authController: new AuthController(authService),
    applicantsController: new ApplicantsController(applicantsService),
    documentsController: new DocumentsController(documentsService),
    jobPostingsController: new JobPostingsController(jobPostingsService),
    applicationsController: new ApplicationsController(applicationsService),
    usersController: new UsersController(usersService),
    auditLogsController: new AuditLogsController(auditLogsService),
    dashboardController: new DashboardController(dashboardService),
    categoriesController: new CategoriesController(categoriesService),
    panelAssignmentsController: new PanelAssignmentsController(panelAssignmentsService),
    panelEvaluationsController: new PanelEvaluationsController(panelEvaluationsService),
    positionsController: new PositionsController(positionsService),
    complianceRequirementsController: new ComplianceRequirementsController(complianceRequirementsService),
    applicantGroupsController: new ApplicantGroupsController(applicantGroupsService),
    historicalHiringDataController: new HistoricalHiringDataController(historicalHiringDataService),
  };
}

export const container = buildContainer();
export type Container = typeof container;
