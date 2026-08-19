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

  async setTemporaryPassword(id: string, passwordHash: string): Promise<void> {
    await this.db.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true } });
  }

  create(email: string, passwordHash: string, role: Role, name?: string): Promise<PublicUser> {
    return this.db.user.create({ data: { email, passwordHash, role, name }, select: publicUserSelect });
  }

  update(id: string, data: { email?: string; role?: Role; name?: string }): Promise<PublicUser> {
    return this.db.user.update({ where: { id }, data, select: publicUserSelect });
  }

  delete(id: string): Promise<User> {
    return this.db.user.delete({ where: { id } });
  }
}
