import type { Applicant, PrismaClient, User } from "@prisma/client";

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

  findByEmailWithApplicant(email: string): Promise<(User & { applicant: Applicant | null }) | null> {
    return this.db.user.findUnique({ where: { email }, include: { applicant: true } });
  }

  findById(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  create(email: string, passwordHash: string): Promise<User> {
    return this.db.user.create({ data: { email, passwordHash } });
  }

  // Any completed password change - self-service or forced after a
  // temporary password - clears mustChangePassword, since both paths end
  // with the account back in a normal, fully-authenticated state. Also
  // bumps tokenVersion so any token issued before this change (e.g. one
  // stolen before the password was rotated) stops being accepted.
  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.db.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: false, tokenVersion: { increment: 1 } },
    });
  }

  async setTemporaryPassword(id: string, passwordHash: string): Promise<void> {
    await this.db.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true, tokenVersion: { increment: 1 } },
    });
  }
}
