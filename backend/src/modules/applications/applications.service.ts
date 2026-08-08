import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors/AppError";
import type { ApplicantsRepository } from "@/modules/applicants/applicants.repository";
import type { DocumentsRepository } from "@/modules/applicants/documents/documents.repository";
import type { JobPostingsRepository } from "@/modules/job-postings/job-postings.repository";
import { JobPostingsService } from "@/modules/job-postings/job-postings.service";
import type { AuditLogsRepository } from "@/modules/audit-logs/audit-logs.repository";
import { AuditAction, AuditEntityType } from "@/modules/audit-logs/audit-actions";
import type { ApplicationsRepository, ApplicationWithApplicant, ApplicationWithPosting } from "./applications.repository";
import type { EvaluateApplicationDto } from "./applications.dto";

export class ApplicationsService {
  constructor(
    private readonly applicationsRepository: ApplicationsRepository,
    private readonly applicantsRepository: ApplicantsRepository,
    private readonly jobPostingsRepository: JobPostingsRepository,
    private readonly documentsRepository: DocumentsRepository,
    private readonly auditLogsRepository: AuditLogsRepository,
  ) {}

  async submit(userId: string, jobPostingId: string): Promise<ApplicationWithPosting> {
    const applicant = await this.applicantsRepository.findByUserId(userId);
    if (!applicant) {
      throw new NotFoundError("Applicant profile");
    }

    const posting = await this.jobPostingsRepository.findById(jobPostingId);
    if (!posting) {
      throw new NotFoundError("Job posting");
    }
    if (!JobPostingsService.isAcceptingApplications(posting)) {
      throw new ValidationError("This job posting is no longer accepting applications");
    }

    const existing = await this.applicationsRepository.findByApplicantAndPosting(applicant.id, jobPostingId);
    if (existing) {
      throw new ConflictError("You have already applied to this job posting");
    }

    if (posting.positionLevel === "PROMOTIONAL") {
      const documents = await this.documentsRepository.findByApplicant(applicant.id);
      const hasIpcr = documents.some((doc) => doc.type === "IPCR");
      const hasDesignation = documents.some((doc) => doc.type === "DESIGNATION_ORDER");
      if (!hasIpcr || !hasDesignation) {
        throw new ValidationError(
          "Promotional applications require an uploaded IPCR and Designation to a Higher Position document",
        );
      }
    }

    if (applicant.hasEligibility) {
      const hasProof = (await this.documentsRepository.findByApplicant(applicant.id)).some(
        (doc) => doc.type === "ELIGIBILITY_PROOF",
      );
      if (!hasProof) {
        throw new ValidationError("Eligibility proof document is required before submitting an application");
      }
    }

    return this.applicationsRepository.create(applicant.id, jobPostingId);
  }

  async listMine(userId: string): Promise<ApplicationWithPosting[]> {
    const applicant = await this.applicantsRepository.findByUserId(userId);
    if (!applicant) {
      throw new NotFoundError("Applicant profile");
    }
    return this.applicationsRepository.findByApplicant(applicant.id);
  }

  listForAdmin(jobPostingId?: string): Promise<ApplicationWithApplicant[]> {
    return this.applicationsRepository.findMany(jobPostingId);
  }

  async evaluate(
    applicationId: string,
    evaluatorUserId: string,
    dto: EvaluateApplicationDto,
  ): Promise<ApplicationWithApplicant> {
    const application = await this.applicationsRepository.findById(applicationId);
    if (!application) {
      throw new NotFoundError("Application");
    }

    const updated = await this.applicationsRepository.evaluate(applicationId, {
      score: dto.score,
      status: dto.decision,
      evaluatedByUserId: evaluatorUserId,
      ...(dto.remarks ? { remarks: dto.remarks } : {}),
    });

    await this.auditLogsRepository.record({
      actorUserId: evaluatorUserId,
      action: AuditAction.APPLICATION_EVALUATED,
      entityType: AuditEntityType.APPLICATION,
      entityId: applicationId,
      details: `Scored ${application.applicant.firstName} ${application.applicant.lastName} for "${application.jobPosting.title}": ${dto.score}/100, ${dto.decision}`,
    });

    return updated;
  }

  async scheduleInterview(applicationId: string, actorUserId: string): Promise<ApplicationWithApplicant> {
    const application = await this.applicationsRepository.findById(applicationId);
    if (!application) {
      throw new NotFoundError("Application");
    }
    if (application.status !== "SUBMITTED" && application.status !== "UNDER_SIFTING") {
      throw new ValidationError(
        `Cannot schedule an interview for an application with status ${application.status}`,
      );
    }

    const updated = await this.applicationsRepository.updateStatus(applicationId, "FOR_INTERVIEW");

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.APPLICATION_SCHEDULED_INTERVIEW,
      entityType: AuditEntityType.APPLICATION,
      entityId: applicationId,
      details: `Scheduled ${application.applicant.firstName} ${application.applicant.lastName} for interview - "${application.jobPosting.title}"`,
    });

    return updated;
  }
}
