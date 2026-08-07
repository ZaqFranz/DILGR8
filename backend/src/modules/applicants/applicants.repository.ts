import type { Applicant, Award, LdIntervention, PrismaClient, WorkExperience } from "@prisma/client";
import type {
  CreateApplicantProfileDto,
  CreateAwardDto,
  CreateLdInterventionDto,
  CreateWorkExperienceDto,
  UpdateApplicantProfileDto,
} from "./applicants.dto";

const fullApplicantInclude = {
  workExperiences: true,
  ldInterventions: true,
  awards: true,
  documents: true,
} as const;

export type ApplicantWithRelations = Applicant & {
  workExperiences: WorkExperience[];
  ldInterventions: LdIntervention[];
  awards: Award[];
};

export class ApplicantsRepository {
  constructor(private readonly db: PrismaClient) {}

  findByUserId(userId: string): Promise<ApplicantWithRelations | null> {
    return this.db.applicant.findUnique({
      where: { userId },
      include: fullApplicantInclude,
    });
  }

  findById(id: string): Promise<ApplicantWithRelations | null> {
    return this.db.applicant.findUnique({
      where: { id },
      include: fullApplicantInclude,
    });
  }

  create(userId: string, dto: CreateApplicantProfileDto): Promise<ApplicantWithRelations> {
    return this.db.applicant.create({
      data: { userId, ...dto },
      include: fullApplicantInclude,
    });
  }

  update(id: string, dto: UpdateApplicantProfileDto): Promise<ApplicantWithRelations> {
    return this.db.applicant.update({
      where: { id },
      data: dto,
      include: fullApplicantInclude,
    });
  }

  addWorkExperience(applicantId: string, dto: CreateWorkExperienceDto): Promise<WorkExperience> {
    return this.db.workExperience.create({ data: { applicantId, ...dto } });
  }

  removeWorkExperience(id: string): Promise<WorkExperience> {
    return this.db.workExperience.delete({ where: { id } });
  }

  addLdIntervention(applicantId: string, dto: CreateLdInterventionDto): Promise<LdIntervention> {
    return this.db.ldIntervention.create({ data: { applicantId, ...dto } });
  }

  removeLdIntervention(id: string): Promise<LdIntervention> {
    return this.db.ldIntervention.delete({ where: { id } });
  }

  addAward(applicantId: string, dto: CreateAwardDto): Promise<Award> {
    return this.db.award.create({ data: { applicantId, ...dto } });
  }

  removeAward(id: string): Promise<Award> {
    return this.db.award.delete({ where: { id } });
  }
}
