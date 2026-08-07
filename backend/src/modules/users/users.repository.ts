import type { PrismaClient, Role, User } from "@prisma/client";

const publicUserSelect = {
  id: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type PublicUser = {
  id: string;
  email: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
};

export interface ListUsersFilters {
  role?: Role;
  search?: string;
}

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

  findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email } });
  }

  create(email: string, passwordHash: string, role: Role): Promise<PublicUser> {
    return this.db.user.create({ data: { email, passwordHash, role }, select: publicUserSelect });
  }

  update(id: string, data: { email?: string; role?: Role }): Promise<PublicUser> {
    return this.db.user.update({ where: { id }, data, select: publicUserSelect });
  }

  delete(id: string): Promise<User> {
    return this.db.user.delete({ where: { id } });
  }
}
