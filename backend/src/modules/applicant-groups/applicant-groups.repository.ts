import type { ApplicantGroup, ApplicantGroupMember, PrismaClient } from "@prisma/client";

const memberApplicationSelect = {
  application: {
    select: {
      id: true,
      jobPosting: { select: { id: true, title: true } },
      applicant: {
        select: { id: true, firstName: true, lastName: true, user: { select: { email: true } } },
      },
    },
  },
} as const;

const groupInclude = {
  members: { include: memberApplicationSelect, orderBy: { createdAt: "asc" } },
} as const;

export type ApplicantGroupMemberWithApplication = ApplicantGroupMember & {
  application: {
    id: string;
    jobPosting: { id: string; title: string };
    applicant: { id: string; firstName: string; lastName: string; user: { email: string } };
  };
};

export type ApplicantGroupWithMembers = ApplicantGroup & {
  members: ApplicantGroupMemberWithApplication[];
};

export interface CreateGroupInput {
  name: string;
  description?: string | undefined;
  applicationIds: string[];
}

export interface UpdateGroupInput {
  name?: string | undefined;
  description?: string | null | undefined;
  applicationIds?: string[] | undefined;
}

export class ApplicantGroupsRepository {
  constructor(private readonly db: PrismaClient) {}

  findMany(): Promise<ApplicantGroupWithMembers[]> {
    return this.db.applicantGroup.findMany({
      include: groupInclude,
      orderBy: { createdAt: "desc" },
    }) as Promise<ApplicantGroupWithMembers[]>;
  }

  findById(id: string): Promise<ApplicantGroupWithMembers | null> {
    return this.db.applicantGroup.findUnique({
      where: { id },
      include: groupInclude,
    }) as Promise<ApplicantGroupWithMembers | null>;
  }

  create(input: CreateGroupInput): Promise<ApplicantGroupWithMembers> {
    return this.db.applicantGroup.create({
      data: {
        name: input.name,
        description: input.description,
        members: { create: input.applicationIds.map((applicationId) => ({ applicationId })) },
      },
      include: groupInclude,
    }) as Promise<ApplicantGroupWithMembers>;
  }

  /**
   * Renames/redescribes in place and, if `applicationIds` is given, diffs
   * membership against what's on file (remove what's missing, add what's
   * new) inside the same transaction - the same add/remove-by-diff shape
   * CategoriesRepository.update() uses for its criteria array, rather than
   * a blind delete-everything-then-recreate that would needlessly churn
   * every member row's id/createdAt even for entries that didn't change.
   */
  async update(id: string, input: UpdateGroupInput): Promise<ApplicantGroupWithMembers> {
    await this.db.$transaction(async (tx) => {
      await tx.applicantGroup.update({
        where: { id },
        data: { name: input.name, description: input.description },
      });

      if (input.applicationIds) {
        const current = await tx.applicantGroupMember.findMany({ where: { groupId: id } });
        const nextIds = new Set(input.applicationIds);
        const currentIds = new Set(current.map((member) => member.applicationId));
        const toRemove = current.filter((member) => !nextIds.has(member.applicationId));
        const toAdd = input.applicationIds.filter((applicationId) => !currentIds.has(applicationId));

        if (toRemove.length > 0) {
          await tx.applicantGroupMember.deleteMany({ where: { id: { in: toRemove.map((member) => member.id) } } });
        }
        if (toAdd.length > 0) {
          await tx.applicantGroupMember.createMany({
            data: toAdd.map((applicationId) => ({ groupId: id, applicationId })),
          });
        }
      }
    });

    return this.findById(id) as Promise<ApplicantGroupWithMembers>;
  }

  delete(id: string): Promise<ApplicantGroup> {
    return this.db.applicantGroup.delete({ where: { id } });
  }
}
