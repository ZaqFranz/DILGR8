import type { EducationLevel, EligibilityType, PrismaClient } from "@prisma/client";
import type { CreateHistoricalHiringRecordDto, UpdateHistoricalHiringRecordDto } from "./historical-hiring-data.dto";

const recordInclude = { awards: true, ldEntries: true } as const;

export type HistoricalHiringRecordWithItems = Awaited<
  ReturnType<HistoricalHiringDataRepository["findById"]>
>;

export interface ApplicantFeatureRow {
  applicationId: string;
  educationLevel: EducationLevel;
  yearsOfExperience: number;
  eligibilityType: EligibilityType;
  awardCount: number;
  ldTotalHours: number;
}

export class HistoricalHiringDataRepository {
  constructor(private readonly db: PrismaClient) {}

  create(enteredByUserId: string, input: CreateHistoricalHiringRecordDto) {
    const { awards, ldEntries, ...scalars } = input;
    return this.db.historicalHiringRecord.create({
      data: {
        ...scalars,
        enteredByUserId,
        awards: { create: awards },
        ldEntries: { create: ldEntries },
      },
      include: recordInclude,
    });
  }

  findById(id: string) {
    return this.db.historicalHiringRecord.findUnique({ where: { id }, include: recordInclude });
  }

  findMany() {
    return this.db.historicalHiringRecord.findMany({ include: recordInclude, orderBy: { createdAt: "desc" } });
  }

  /**
   * Awards/L&D entries are replaced wholesale (delete-all + recreate) in
   * one transaction rather than diffed - the frontend always submits the
   * record's complete current item lists, so a diff would add complexity
   * with no behavioral difference for a form that isn't itemizing
   * individual add/remove API calls.
   */
  async update(id: string, data: UpdateHistoricalHiringRecordDto) {
    const { awards, ldEntries, ...scalars } = data;
    return this.db.$transaction(async (tx) => {
      if (awards) {
        await tx.historicalHiringAward.deleteMany({ where: { historicalHiringRecordId: id } });
      }
      if (ldEntries) {
        await tx.historicalHiringLdEntry.deleteMany({ where: { historicalHiringRecordId: id } });
      }
      return tx.historicalHiringRecord.update({
        where: { id },
        data: {
          ...scalars,
          ...(awards ? { awards: { create: awards } } : {}),
          ...(ldEntries ? { ldEntries: { create: ldEntries } } : {}),
        },
        include: recordInclude,
      });
    });
  }

  delete(id: string) {
    return this.db.historicalHiringRecord.delete({ where: { id } });
  }

  async findApplicantFeaturesByApplicationIds(applicationIds: string[]): Promise<ApplicantFeatureRow[]> {
    const applications = await this.db.application.findMany({
      where: { id: { in: applicationIds } },
      select: {
        id: true,
        applicant: {
          select: {
            educationLevel: true,
            yearsOfExperience: true,
            eligibilityType: true,
            awards: { select: { id: true } },
            ldInterventions: { select: { numberOfHours: true } },
          },
        },
      },
    });

    return applications.map((application) => ({
      applicationId: application.id,
      educationLevel: application.applicant.educationLevel,
      yearsOfExperience: application.applicant.yearsOfExperience,
      eligibilityType: application.applicant.eligibilityType,
      awardCount: application.applicant.awards.length,
      ldTotalHours: application.applicant.ldInterventions.reduce((sum, ld) => sum + ld.numberOfHours, 0),
    }));
  }
}
