import type { Position, PrismaClient } from "@prisma/client";

export type PositionPanelMemberWithUser = {
  id: string;
  panelUserId: string;
  panelUser: { id: string; email: string; name: string | null };
};

export type PositionWithPanelMembers = Position & { panelMembers: PositionPanelMemberWithUser[] };

export interface CreatePositionInput {
  title: string;
  panelUserIds?: string[];
}

export interface UpdatePositionInput {
  title?: string;
  panelUserIds?: string[];
}

const panelMembersInclude = {
  panelMembers: {
    include: { panelUser: { select: { id: true, email: true, name: true } } },
  },
} as const;

export class PositionsRepository {
  constructor(private readonly db: PrismaClient) {}

  create(input: CreatePositionInput): Promise<PositionWithPanelMembers> {
    return this.db.position.create({
      data: {
        title: input.title,
        panelMembers: {
          create: (input.panelUserIds ?? []).map((panelUserId) => ({ panelUserId })),
        },
      },
      include: panelMembersInclude,
    });
  }

  findById(id: string): Promise<PositionWithPanelMembers | null> {
    return this.db.position.findUnique({ where: { id }, include: panelMembersInclude });
  }

  findMany(): Promise<PositionWithPanelMembers[]> {
    return this.db.position.findMany({
      include: panelMembersInclude,
      orderBy: { title: "asc" },
    });
  }

  async update(id: string, data: UpdatePositionInput): Promise<PositionWithPanelMembers> {
    const { panelUserIds, ...positionFields } = data;
    return this.db.$transaction(async (tx) => {
      await tx.position.update({ where: { id }, data: positionFields });
      if (panelUserIds !== undefined) {
        await tx.positionPanelMember.deleteMany({ where: { positionId: id } });
        await tx.positionPanelMember.createMany({
          data: panelUserIds.map((panelUserId) => ({ positionId: id, panelUserId })),
        });
      }
      return tx.position.findUniqueOrThrow({ where: { id }, include: panelMembersInclude });
    });
  }

  delete(id: string): Promise<Position> {
    return this.db.position.delete({ where: { id } });
  }
}
