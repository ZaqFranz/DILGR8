import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors/AppError";
import { generateTemporaryPassword, hashPassword } from "@/shared/utils/password";
import type { EmailService } from "@/shared/email/emailService";
import { temporaryPasswordEmail } from "@/shared/email/authEmailTemplates";
import type { AuditLogsRepository } from "@/modules/audit-logs/audit-logs.repository";
import { AuditAction, AuditEntityType } from "@/modules/audit-logs/audit-actions";
import type { ListUsersFilters, PublicUser, UsersRepository } from "./users.repository";
import type { CreateUserDto, UpdateUserDto } from "./users.dto";

export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly auditLogsRepository: AuditLogsRepository,
    private readonly emailService: EmailService,
  ) {}

  list(filters: ListUsersFilters): Promise<PublicUser[]> {
    return this.usersRepository.findMany(filters);
  }

  async create(actorUserId: string, dto: CreateUserDto): Promise<PublicUser> {
    const existing = await this.usersRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictError("A user with this email already exists");
    }

    const passwordHash = await hashPassword(dto.password);
    const user = await this.usersRepository.create(dto.email, passwordHash, dto.role, dto.name);

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.USER_CREATED,
      entityType: AuditEntityType.USER,
      entityId: user.id,
      details: `Created ${user.role} account for ${user.email}`,
    });

    return user;
  }

  async update(actorUserId: string, userId: string, dto: UpdateUserDto): Promise<PublicUser> {
    const target = await this.usersRepository.findById(userId);
    if (!target) {
      throw new NotFoundError("User");
    }

    // Same reasoning as the self-delete guard in remove() below: changing
    // your own role away from ADMIN can lock every admin out of the admin
    // panel with no in-app recovery path, and unlike delete this wasn't
    // guarded at all before.
    if (actorUserId === userId && dto.role && dto.role !== target.role) {
      throw new ValidationError("You cannot change your own role");
    }

    if (dto.email && dto.email !== target.email) {
      const existing = await this.usersRepository.findByEmail(dto.email);
      if (existing) {
        throw new ConflictError("A user with this email already exists");
      }
    }

    const updated = await this.usersRepository.update(userId, dto);

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.USER_UPDATED,
      entityType: AuditEntityType.USER,
      entityId: userId,
      details: `Updated ${JSON.stringify(dto)} for ${target.email}`,
    });

    return updated;
  }

  async remove(actorUserId: string, userId: string): Promise<void> {
    if (actorUserId === userId) {
      throw new ValidationError("You cannot delete your own account");
    }

    const target = await this.usersRepository.findById(userId);
    if (!target) {
      throw new NotFoundError("User");
    }

    await this.usersRepository.delete(userId);

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.USER_DELETED,
      entityType: AuditEntityType.USER,
      entityId: userId,
      details: `Deleted ${target.role} account for ${target.email}`,
    });
  }

  /**
   * Admin-initiated counterpart to AuthService.forgotPassword() - closes the
   * gap noted in docs/project-memory.md's Known Limitations ("no in-app
   * password recovery for ADMIN/PANEL", who can't use the applicant-only
   * self-service flow). Works for any role since there's no reason to
   * exclude APPLICANT accounts an admin might legitimately need to help.
   */
  async resetPassword(actorUserId: string, userId: string): Promise<void> {
    const target = await this.usersRepository.findByIdForPasswordReset(userId);
    if (!target) {
      throw new NotFoundError("User");
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    await this.usersRepository.setTemporaryPassword(userId, passwordHash);

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.USER_TEMPORARY_PASSWORD_ISSUED,
      entityType: AuditEntityType.USER,
      entityId: userId,
      details: `Admin-issued temporary password for ${target.email}`,
    });

    const displayName = target.name ?? (target.applicant ? `${target.applicant.firstName} ${target.applicant.lastName}` : target.email);
    const { subject, html } = temporaryPasswordEmail(displayName, temporaryPassword);
    await this.emailService.send({ to: target.email, subject, html });
  }
}
