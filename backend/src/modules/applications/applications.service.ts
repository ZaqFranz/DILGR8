import type { Role } from "@prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors/AppError";
import type { ApplicantsRepository } from "@/modules/applicants/applicants.repository";
import type { DocumentsRepository } from "@/modules/applicants/documents/documents.repository";
import type { UploadedFileInfo } from "@/modules/applicants/documents/documents.service";
import type { JobPostingsRepository } from "@/modules/job-postings/job-postings.repository";
import { JobPostingsService } from "@/modules/job-postings/job-postings.service";
import type { AuditLogsRepository } from "@/modules/audit-logs/audit-logs.repository";
import { AuditAction, AuditEntityType } from "@/modules/audit-logs/audit-actions";
import type {
  ComplianceItemsRepository,
  ApplicationComplianceItemWithDetails,
} from "@/modules/compliance-requirements/compliance-items.repository";
import type { ComplianceRequirementsRepository } from "@/modules/compliance-requirements/compliance-requirements.repository";
import type { EmailService } from "@/shared/email/emailService";
import {
  complianceRequestedEmail,
  decisionEmail,
  examScoreEmail,
  forInterviewEmail,
  hiredEmail,
  oathTakingScheduledEmail,
  submittedEmail,
  withdrawnEmail,
} from "@/shared/email/applicationEmailTemplates";
import type { ApplicationsRepository, ApplicationWithApplicant, ApplicationWithPosting } from "./applications.repository";
import type {
  ReviewComplianceItemDto,
  ScheduleInterviewDto,
  ScheduleOathTakingDto,
  SetExamScoreDto,
  SiftApplicationDto,
} from "./applications.dto";
import ExcelJS from "exceljs";
import { parseExamScoreWorkbook } from "./examScoreParser";

// An application can be withdrawn any time before its outcome is already
// final - NOT_QUALIFIED and WITHDRAWN itself are terminal, so they're the
// only statuses excluded here. FOR_COMPLIANCE/FOR_OATH_TAKING stay
// withdrawable (an applicant can still decline up until actually hired);
// HIRED itself is excluded the same way NOT_QUALIFIED is.
const WITHDRAWABLE_STATUSES = [
  "SUBMITTED",
  "UNDER_SIFTING",
  "QUALIFIED",
  "FOR_INTERVIEW",
  "FOR_COMPLIANCE",
  "FOR_OATH_TAKING",
] as const;

const ELIGIBILITY_LABELS: Record<string, string> = {
  RA1080: "RA 1080",
  CSC_PROFESSIONAL: "Second-Level Eligibility (Professional)",
  CSC_SUBPROFESSIONAL: "First-Level Eligibility (Subprofessional)",
  BARANGAY: "Barangay Eligibility",
};

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, "") // "R." vs "R" shouldn't be a mismatch
    .replace(/\s+/g, " ")
    .trim();
}

// PQE score sheets are hand-written outside the system and commonly include
// the middle name/initial and/or suffix even though the rest of the app
// only ever displays "firstName lastName" - so a plain firstName+lastName
// key would silently fail to match e.g. "Gibo R. Ormeneta" against an
// applicant on file as firstName "Gibo", middleName "R.", lastName
// "Ormeneta". Generate every name form a spreadsheet realistically uses and
// index all of them to the same application.
function buildNameVariants(applicant: {
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
}): string[] {
  const { firstName, middleName, lastName, suffix } = applicant;
  const middleInitial = middleName ? `${middleName.trim().charAt(0)}.` : null;

  const baseNames = [
    `${firstName} ${lastName}`,
    middleName ? `${firstName} ${middleName} ${lastName}` : null,
    middleInitial ? `${firstName} ${middleInitial} ${lastName}` : null,
  ].filter((name): name is string => name !== null);

  const withSuffix = suffix ? baseNames.map((name) => `${name} ${suffix}`) : [];

  return [...baseNames, ...withSuffix].map(normalizeName);
}

export interface ExamScoreImportResult {
  matched: { applicationId: string; applicantName: string; score: number }[];
  unmatched: { name: string; score: number; jobTitle?: string }[];
}

export class ApplicationsService {
  constructor(
    private readonly applicationsRepository: ApplicationsRepository,
    private readonly applicantsRepository: ApplicantsRepository,
    private readonly jobPostingsRepository: JobPostingsRepository,
    private readonly documentsRepository: DocumentsRepository,
    private readonly auditLogsRepository: AuditLogsRepository,
    private readonly emailService: EmailService,
    private readonly complianceItemsRepository: ComplianceItemsRepository,
    private readonly complianceRequirementsRepository: ComplianceRequirementsRepository,
  ) {}

  async submit(
    userId: string,
    jobPostingId: string,
    applicantEmail: string,
    file?: UploadedFileInfo,
  ): Promise<ApplicationWithPosting> {
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

    if (posting.requiredEligibilityTypes.length > 0) {
      const satisfiesEligibility =
        applicant.hasEligibility && posting.requiredEligibilityTypes.includes(applicant.eligibilityType);
      if (!satisfiesEligibility) {
        const required = posting.requiredEligibilityTypes.map((type) => ELIGIBILITY_LABELS[type] ?? type).join(", ");
        throw new ValidationError(
          `This job posting requires one of the following eligibilities: ${required}. Update your eligibility on your profile before applying.`,
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

    if (!file) {
      throw new ValidationError("An Application Letter is required to submit an application");
    }

    const created = await this.applicationsRepository.createWithApplicationLetter(applicant.id, jobPostingId, {
      fileName: file.originalname,
      filePath: file.path,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
    });

    const { subject, html } = submittedEmail(`${applicant.firstName} ${applicant.lastName}`, posting.title);
    await this.emailService.send({ to: applicantEmail, subject, html });

    return created;
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

  async withdraw(applicationId: string, userId: string): Promise<ApplicationWithApplicant> {
    const applicant = await this.applicantsRepository.findByUserId(userId);
    if (!applicant) {
      throw new NotFoundError("Applicant profile");
    }

    const application = await this.applicationsRepository.findById(applicationId);
    // Applicants can't distinguish "doesn't exist" from "isn't yours" -
    // 404 either way, same as any other resource lookup scoped to the caller.
    if (!application || application.applicantId !== applicant.id) {
      throw new NotFoundError("Application");
    }
    if (!WITHDRAWABLE_STATUSES.includes(application.status as (typeof WITHDRAWABLE_STATUSES)[number])) {
      throw new ValidationError(`Cannot withdraw an application with status ${application.status}`);
    }

    const updated = await this.applicationsRepository.withdraw(applicationId);

    const { subject, html } = withdrawnEmail(
      `${application.applicant.firstName} ${application.applicant.lastName}`,
      application.jobPosting.title,
    );
    await this.emailService.send({ to: application.applicant.user.email, subject, html });

    return updated;
  }

  async sift(
    applicationId: string,
    actorUserId: string,
    dto: SiftApplicationDto,
  ): Promise<ApplicationWithApplicant> {
    const application = await this.applicationsRepository.findById(applicationId);
    if (!application) {
      throw new NotFoundError("Application");
    }
    if (application.status !== "UNDER_SIFTING") {
      throw new ValidationError(`Cannot record a sifting decision for an application with status ${application.status}`);
    }

    const updated = await this.applicationsRepository.sift(applicationId, {
      status: dto.decision,
      siftedByUserId: actorUserId,
      ...(dto.remarks ? { remarks: dto.remarks } : {}),
    });

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.APPLICATION_SIFTED,
      entityType: AuditEntityType.APPLICATION,
      entityId: applicationId,
      details: `Sifted ${application.applicant.firstName} ${application.applicant.lastName} for "${application.jobPosting.title}": ${dto.decision}`,
    });

    const { subject, html } = decisionEmail(
      `${application.applicant.firstName} ${application.applicant.lastName}`,
      application.jobPosting.title,
      dto.decision,
    );
    await this.emailService.send({ to: application.applicant.user.email, subject, html });

    return updated;
  }

  /**
   * Excel of Qualified applicants still missing a PQE score, in the same
   * shape importExaminationScores() reads (Name/Score/Job Title) - an admin
   * can fill in the blank Score column and re-upload it directly via
   * "Import PQE Scores" instead of hand-typing a spreadsheet from scratch.
   */
  async exportPendingPqeScores(jobPostingId: string | undefined): Promise<Buffer> {
    const applications = await this.applicationsRepository.findMany(jobPostingId);
    const pending = applications.filter(
      (application) => application.status === "QUALIFIED" && application.examinationScore === null,
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Pending PQE Scores");
    sheet.columns = [
      { header: "Name", key: "name", width: 30 },
      { header: "Score", key: "score", width: 10 },
      { header: "Job Title", key: "jobTitle", width: 35 },
    ];
    for (const application of pending) {
      sheet.addRow({
        name: `${application.applicant.firstName} ${application.applicant.lastName}`,
        score: "",
        jobTitle: application.jobPosting.title,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async importExaminationScores(
    jobPostingId: string | undefined,
    actorUserId: string,
    fileBuffer: Buffer,
  ): Promise<ExamScoreImportResult> {
    const rows = await parseExamScoreWorkbook(fileBuffer);

    const applications = await this.applicationsRepository.findMany(jobPostingId);
    const qualified = applications.filter((application) => application.status === "QUALIFIED");

    const matched: ExamScoreImportResult["matched"] = [];
    const unmatched: ExamScoreImportResult["unmatched"] = [];

    if (jobPostingId) {
      // Single posting selected - name alone is enough to disambiguate,
      // since every candidate here is Qualified on the same posting. Job
      // Title column, if present in the sheet, is ignored (extra column).
      const byNormalizedName = new Map<string, (typeof qualified)[number]>();
      for (const application of qualified) {
        for (const variant of buildNameVariants(application.applicant)) {
          byNormalizedName.set(variant, application);
        }
      }
      for (const row of rows) {
        const application = byNormalizedName.get(normalizeName(row.name));
        if (!application) {
          unmatched.push({ name: row.name, score: row.score });
          continue;
        }
        matched.push({
          applicationId: application.id,
          applicantName: `${application.applicant.firstName} ${application.applicant.lastName}`,
          score: row.score,
        });
      }
    } else {
      // All job postings - an applicant can be Qualified on more than one
      // posting at once, so name alone is ambiguous. Require the sheet's
      // Job Title column and match on name + job title together.
      const byNormalizedNameAndTitle = new Map<string, (typeof qualified)[number]>();
      for (const application of qualified) {
        const titleKey = normalizeName(application.jobPosting.title);
        for (const nameVariant of buildNameVariants(application.applicant)) {
          byNormalizedNameAndTitle.set(`${nameVariant}::${titleKey}`, application);
        }
      }
      for (const row of rows) {
        if (!row.jobTitle) {
          unmatched.push({ name: row.name, score: row.score });
          continue;
        }
        const key = `${normalizeName(row.name)}::${normalizeName(row.jobTitle)}`;
        const application = byNormalizedNameAndTitle.get(key);
        if (!application) {
          unmatched.push({ name: row.name, score: row.score, jobTitle: row.jobTitle });
          continue;
        }
        matched.push({
          applicationId: application.id,
          applicantName: `${application.applicant.firstName} ${application.applicant.lastName}`,
          score: row.score,
        });
      }
    }

    await this.applicationsRepository.bulkSetExaminationScores(
      matched.map((m) => ({ applicationId: m.applicationId, score: m.score })),
    );

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.APPLICATION_EXAM_SCORES_IMPORTED,
      entityType: AuditEntityType.APPLICATION,
      ...(jobPostingId ? { entityId: jobPostingId } : {}),
      details: jobPostingId
        ? `Imported PQE scores for job posting ${jobPostingId}: ${matched.length} matched, ${unmatched.length} unmatched`
        : `Imported PQE scores across all job postings: ${matched.length} matched, ${unmatched.length} unmatched`,
    });

    for (const application of qualified) {
      const match = matched.find((m) => m.applicationId === application.id);
      if (!match) continue;
      const { subject, html } = examScoreEmail(
        `${application.applicant.firstName} ${application.applicant.lastName}`,
        application.jobPosting.title,
        match.score,
      );
      await this.emailService.send({ to: application.applicant.user.email, subject, html });
    }

    return { matched, unmatched };
  }

  /**
   * Manual, single-application alternative to importExaminationScores above
   * - same underlying update and notification, for admins who'd rather key
   * in one score than build a whole spreadsheet for it.
   */
  async setExaminationScore(
    applicationId: string,
    actorUserId: string,
    dto: SetExamScoreDto,
  ): Promise<ApplicationWithApplicant> {
    const application = await this.applicationsRepository.findById(applicationId);
    if (!application) {
      throw new NotFoundError("Application");
    }
    if (application.status !== "QUALIFIED") {
      throw new ValidationError("Cannot record a PQE score unless the application is Qualified (sifting must pass first)");
    }

    const updated = await this.applicationsRepository.setExaminationScore(applicationId, dto.score);

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.APPLICATION_EXAM_SCORE_SET,
      entityType: AuditEntityType.APPLICATION,
      entityId: applicationId,
      details: `Set PQE score for ${application.applicant.firstName} ${application.applicant.lastName} ("${application.jobPosting.title}"): ${dto.score}`,
    });

    const { subject, html } = examScoreEmail(
      `${application.applicant.firstName} ${application.applicant.lastName}`,
      application.jobPosting.title,
      dto.score,
    );
    await this.emailService.send({ to: application.applicant.user.email, subject, html });

    return updated;
  }

  async scheduleInterview(
    applicationId: string,
    actorUserId: string,
    dto: ScheduleInterviewDto,
  ): Promise<ApplicationWithApplicant> {
    const application = await this.applicationsRepository.findById(applicationId);
    if (!application) {
      throw new NotFoundError("Application");
    }
    if (application.status !== "QUALIFIED" || application.examinationScore === null) {
      throw new ValidationError(
        "Cannot schedule an evaluation until the applicant has passed sifting and has a recorded PQE score",
      );
    }
    if (dto.scheduledAt.getTime() <= Date.now()) {
      throw new ValidationError("Evaluation date/time must be in the future");
    }

    const updated = await this.applicationsRepository.scheduleInterview(applicationId, {
      scheduledAt: dto.scheduledAt,
      ...(dto.scheduledEndAt ? { scheduledEndAt: dto.scheduledEndAt } : {}),
      venue: dto.venue,
      ...(dto.attire ? { attire: dto.attire } : {}),
      ...(dto.notes ? { notes: dto.notes } : {}),
    });

    const dateRangeDetail = dto.scheduledEndAt
      ? `from ${dto.scheduledAt.toISOString()} to ${dto.scheduledEndAt.toISOString()}`
      : `on ${dto.scheduledAt.toISOString()}`;
    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.APPLICATION_SCHEDULED_INTERVIEW,
      entityType: AuditEntityType.APPLICATION,
      entityId: applicationId,
      details: `Scheduled ${application.applicant.firstName} ${application.applicant.lastName} for evaluation - "${application.jobPosting.title}" ${dateRangeDetail} at ${dto.venue}`,
    });

    const { subject, html } = forInterviewEmail(
      `${application.applicant.firstName} ${application.applicant.lastName}`,
      application.jobPosting.title,
      dto.scheduledAt,
      dto.venue,
      dto.attire,
      dto.notes,
      dto.scheduledEndAt,
    );
    await this.emailService.send({ to: application.applicant.user.email, subject, html });

    return updated;
  }

  /**
   * The RD's decision to advance this applicant past Evaluation - there's no
   * separate "Deliberation" status (see docs/decisions.md), this is that
   * judgment call. Snapshots one PENDING ApplicationComplianceItem per
   * currently-active ComplianceRequirement; a requirement added later won't
   * retroactively appear on an already-in-progress applicant's checklist.
   */
  async moveToCompliance(applicationId: string, actorUserId: string): Promise<ApplicationWithApplicant> {
    const application = await this.applicationsRepository.findById(applicationId);
    if (!application) {
      throw new NotFoundError("Application");
    }
    if (application.status !== "FOR_INTERVIEW") {
      throw new ValidationError(`Cannot move to Compliance an application with status ${application.status}`);
    }

    const activeRequirements = await this.complianceRequirementsRepository.findMany(true);

    const updated = await this.applicationsRepository.moveToCompliance(applicationId);
    if (activeRequirements.length > 0) {
      await this.complianceItemsRepository.createManyForApplication(
        applicationId,
        activeRequirements.map((requirement) => requirement.id),
      );
    }

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.APPLICATION_MOVED_TO_COMPLIANCE,
      entityType: AuditEntityType.APPLICATION,
      entityId: applicationId,
      details: `Moved ${application.applicant.firstName} ${application.applicant.lastName} to Compliance to Requirements for "${application.jobPosting.title}" (${activeRequirements.length} requirement(s))`,
    });

    const { subject, html } = complianceRequestedEmail(
      `${application.applicant.firstName} ${application.applicant.lastName}`,
      application.jobPosting.title,
      activeRequirements.map((requirement) => requirement.name),
    );
    await this.emailService.send({ to: application.applicant.user.email, subject, html });

    return updated;
  }

  /** APPLICANT can only read their own application's checklist; ADMIN can read any - same role-branch shape as DocumentsService.listForApplicant(). */
  async listComplianceItems(
    applicationId: string,
    viewer: { id: string; role: Role },
  ): Promise<ApplicationComplianceItemWithDetails[]> {
    const application = await this.applicationsRepository.findById(applicationId);
    if (!application) {
      throw new NotFoundError("Application");
    }
    if (viewer.role === "APPLICANT") {
      const applicant = await this.applicantsRepository.findByUserId(viewer.id);
      if (!applicant || application.applicantId !== applicant.id) {
        throw new NotFoundError("Application");
      }
    }
    return this.complianceItemsRepository.findByApplication(applicationId);
  }

  /** Verifying/rejecting requires the applicant to have already uploaded a COMPLIANCE_PROOF document for this item - there's nothing to review otherwise. */
  async reviewComplianceItem(
    applicationId: string,
    itemId: string,
    actorUserId: string,
    dto: ReviewComplianceItemDto,
  ): Promise<ApplicationComplianceItemWithDetails> {
    const item = await this.complianceItemsRepository.findById(itemId);
    if (!item || item.applicationId !== applicationId) {
      throw new NotFoundError("Compliance item");
    }
    if (item.documents.length === 0) {
      throw new ValidationError("The applicant hasn't submitted proof for this requirement yet");
    }

    const updated = await this.complianceItemsRepository.update(itemId, {
      status: dto.status,
      remarks: dto.remarks,
      reviewedByUserId: actorUserId,
    });

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.APPLICATION_COMPLIANCE_ITEM_REVIEWED,
      entityType: AuditEntityType.APPLICATION,
      entityId: applicationId,
      details: `Reviewed "${item.requirement.name}" for application ${applicationId}: ${dto.status}`,
    });

    return updated;
  }

  /** Bundles the FOR_COMPLIANCE -> FOR_OATH_TAKING transition with the ceremony's schedule - same shape as scheduleInterview(). */
  async scheduleOathTaking(
    applicationId: string,
    actorUserId: string,
    dto: ScheduleOathTakingDto,
  ): Promise<ApplicationWithApplicant> {
    const application = await this.applicationsRepository.findById(applicationId);
    if (!application) {
      throw new NotFoundError("Application");
    }
    if (application.status !== "FOR_COMPLIANCE") {
      throw new ValidationError(`Cannot schedule oath-taking for an application with status ${application.status}`);
    }
    const unverifiedCount = await this.complianceItemsRepository.countUnverified(applicationId);
    if (unverifiedCount > 0) {
      throw new ValidationError(
        `${unverifiedCount} compliance requirement(s) still need to be verified before scheduling oath-taking`,
      );
    }
    if (dto.scheduledAt.getTime() <= Date.now()) {
      throw new ValidationError("Oath-taking date/time must be in the future");
    }

    const updated = await this.applicationsRepository.scheduleOathTaking(applicationId, {
      scheduledAt: dto.scheduledAt,
      venue: dto.venue,
      ...(dto.notes ? { notes: dto.notes } : {}),
    });

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.APPLICATION_OATH_TAKING_SCHEDULED,
      entityType: AuditEntityType.APPLICATION,
      entityId: applicationId,
      details: `Scheduled ${application.applicant.firstName} ${application.applicant.lastName} for oath-taking - "${application.jobPosting.title}" on ${dto.scheduledAt.toISOString()} at ${dto.venue}`,
    });

    const { subject, html } = oathTakingScheduledEmail(
      `${application.applicant.firstName} ${application.applicant.lastName}`,
      application.jobPosting.title,
      dto.scheduledAt,
      dto.venue,
      dto.notes,
    );
    await this.emailService.send({ to: application.applicant.user.email, subject, html });

    return updated;
  }

  /** Terminal for this pipeline segment - Onboarding itself (videos, pre/post evaluations) is future work. */
  async markHired(applicationId: string, actorUserId: string): Promise<ApplicationWithApplicant> {
    const application = await this.applicationsRepository.findById(applicationId);
    if (!application) {
      throw new NotFoundError("Application");
    }
    if (application.status !== "FOR_OATH_TAKING") {
      throw new ValidationError(`Cannot mark hired an application with status ${application.status}`);
    }

    const updated = await this.applicationsRepository.markHired(applicationId);

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.APPLICATION_HIRED,
      entityType: AuditEntityType.APPLICATION,
      entityId: applicationId,
      details: `Marked ${application.applicant.firstName} ${application.applicant.lastName} hired for "${application.jobPosting.title}"`,
    });

    const { subject, html } = hiredEmail(
      `${application.applicant.firstName} ${application.applicant.lastName}`,
      application.jobPosting.title,
    );
    await this.emailService.send({ to: application.applicant.user.email, subject, html });

    return updated;
  }
}
