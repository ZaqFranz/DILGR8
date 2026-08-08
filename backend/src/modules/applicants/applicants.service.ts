import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors/AppError";
import type { DocumentsRepository } from "./documents/documents.repository";
import type { ApplicantsRepository, ApplicantWithRelations } from "./applicants.repository";
import type {
  CreateApplicantProfileDto,
  CreateAwardDto,
  CreateLdInterventionDto,
  CreateWorkExperienceDto,
  UpdateApplicantProfileDto,
} from "./applicants.dto";

export class ApplicantsService {
  constructor(
    private readonly applicantsRepository: ApplicantsRepository,
    private readonly documentsRepository: DocumentsRepository,
  ) {}

  async getMyProfile(userId: string): Promise<ApplicantWithRelations> {
    const applicant = await this.applicantsRepository.findByUserId(userId);
    if (!applicant) {
      throw new NotFoundError("Applicant profile");
    }
    return applicant;
  }

  async createProfile(userId: string, dto: CreateApplicantProfileDto): Promise<ApplicantWithRelations> {
    const existing = await this.applicantsRepository.findByUserId(userId);
    if (existing) {
      throw new ConflictError("Applicant profile already exists for this account");
    }
    // Eligibility(N) is flagged for manual admin validation rather than
    // rejected outright; Eligibility(Y) still requires admin sign-off once
    // proof is uploaded, so eligibilityValidated always starts false.
    return this.applicantsRepository.create(userId, dto);
  }

  async updateProfile(userId: string, dto: UpdateApplicantProfileDto): Promise<ApplicantWithRelations> {
    const applicant = await this.getMyProfile(userId);
    return this.applicantsRepository.update(applicant.id, dto);
  }

  /**
   * Marks the applicant as having finished every registration step. All
   * applicant-side data (profile, work experience, L&D, awards, documents)
   * must be captured here, before this flag is set - nothing about the
   * applicant's own record should be collected after they start using the
   * rest of the app.
   */
  async completeRegistration(userId: string): Promise<ApplicantWithRelations> {
    const applicant = await this.getMyProfile(userId);
    if (applicant.registrationCompletedAt) {
      return applicant;
    }

    if (applicant.hasEligibility) {
      const documents = await this.documentsRepository.findByApplicant(applicant.id);
      const hasEligibilityProof = documents.some((doc) => doc.type === "ELIGIBILITY_PROOF");
      if (!hasEligibilityProof) {
        throw new ValidationError("Upload proof of eligibility before completing registration");
      }
    }

    return this.applicantsRepository.markRegistrationComplete(applicant.id);
  }

  async addWorkExperience(userId: string, dto: CreateWorkExperienceDto) {
    const applicant = await this.getMyProfile(userId);
    return this.applicantsRepository.addWorkExperience(applicant.id, dto);
  }

  async removeWorkExperience(userId: string, workExperienceId: string): Promise<void> {
    const applicant = await this.getMyProfile(userId);
    this.assertOwnsChild(applicant.workExperiences, workExperienceId, "Work experience");
    await this.applicantsRepository.removeWorkExperience(workExperienceId);
  }

  async addLdIntervention(userId: string, dto: CreateLdInterventionDto) {
    const applicant = await this.getMyProfile(userId);
    return this.applicantsRepository.addLdIntervention(applicant.id, dto);
  }

  async removeLdIntervention(userId: string, ldInterventionId: string): Promise<void> {
    const applicant = await this.getMyProfile(userId);
    this.assertOwnsChild(applicant.ldInterventions, ldInterventionId, "L&D intervention");
    await this.applicantsRepository.removeLdIntervention(ldInterventionId);
  }

  async addAward(userId: string, dto: CreateAwardDto) {
    const applicant = await this.getMyProfile(userId);
    return this.applicantsRepository.addAward(applicant.id, dto);
  }

  async removeAward(userId: string, awardId: string): Promise<void> {
    const applicant = await this.getMyProfile(userId);
    this.assertOwnsChild(applicant.awards, awardId, "Award");
    await this.applicantsRepository.removeAward(awardId);
  }

  private assertOwnsChild(children: { id: string }[], childId: string, label: string): void {
    if (!children.some((child) => child.id === childId)) {
      throw new NotFoundError(label);
    }
  }
}
