import type { PrismaClient, User } from "@prisma/client";

/**
 * Repository pattern: isolates auth's data access behind a small
 * interface so AuthService never talks to Prisma directly. Makes the
 * service unit-testable with an in-memory fake.
 */
export class AuthRepository {
  constructor(private readonly db: PrismaClient) {}

  findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  create(email: string, passwordHash: string): Promise<User> {
    return this.db.user.create({ data: { email, passwordHash } });
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.db.user.update({ where: { id }, data: { passwordHash } });
  }
}
