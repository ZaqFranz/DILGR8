import type { PrismaClient, Role, User } from "@prisma/client";

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  // APPLICANT accounts never set User.name (see the field's comment on the
  // model) - Users Management derives their display name from here instead.
  applicant: { select: { firstName: true, lastName: true } },
} as const;

export type PublicUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
  applicant: { firstName: string; lastName: string } | null;
};

export interface ListUsersFilters {
  role?: Role;
  search?: string;
}

export type UserForPasswordReset = {
  id: string;
  email: string;
  name: string | null;
  applicant: { firstName: string; lastName: string } | null;
};

export class UsersRepository {
  constructor(private readonly db: PrismaClient) {}

  findMany(filters: ListUsersFilters): Promise<PublicUser[]> {
    return this.db.user.findMany({
      where: {
        role: filters.role,
        email: filters.search ? { contains: filters.search } : undefined,
      },
      select: publicUserSelect,
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: string): Promise<PublicUser | null> {
    return this.db.user.findUnique({ where: { id }, select: publicUserSelect });
  }

  findByIds(ids: string[]): Promise<PublicUser[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.db.user.findMany({ where: { id: { in: ids } }, select: publicUserSelect });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email } });
  }

  // Only the fields resetPassword()'s email greeting needs - the display
  // name falls back from User.name (ADMIN/PANEL) to the Applicant's
  // first/last name (APPLICANT accounts don't set User.name) to email.
  findByIdForPasswordReset(id: string): Promise<UserForPasswordReset | null> {
    return this.db.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, applicant: { select: { firstName: true, lastName: true } } },
    });
  }

  // Bumps tokenVersion alongside the temporary password so a token issued
  // before this reset stops being accepted (see User.tokenVersion).
  async setTemporaryPassword(id: string, passwordHash: string): Promise<void> {
    await this.db.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true, tokenVersion: { increment: 1 } },
    });
  }

  create(email: string, passwordHash: string, role: Role, name?: string): Promise<PublicUser> {
    return this.db.user.create({ data: { email, passwordHash, role, name }, select: publicUserSelect });
  }

  // Bumps tokenVersion on every admin-initiated update (not just role
  // changes) so a token issued before the change is forced to re-auth -
  // simplest safe rule, since this route is entirely ADMIN-gated already.
  update(id: string, data: { email?: string; role?: Role; name?: string }): Promise<PublicUser> {
    return this.db.user.update({
      where: { id },
      data: { ...data, tokenVersion: { increment: 1 } },
      select: publicUserSelect,
    });
  }

  delete(id: string): Promise<User> {
    return this.db.user.delete({ where: { id } });
  }

  // Applicant -> Application -> (PanelEvaluation / ApplicationComplianceItem
  // / Document / ApplicantGroupMember) all cascade-delete with the User, so
  // this is checked before delete() to keep a hard-delete from silently
  // wiping a real hiring record (see docs/decisions.md).
  async hasApplicationHistory(userId: string): Promise<boolean> {
    const count = await this.db.application.count({ where: { applicant: { userId } } });
    return count > 0;
  }
}
