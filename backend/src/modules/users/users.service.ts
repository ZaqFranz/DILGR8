import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors/AppError";
import { hashPassword } from "@/shared/utils/password";
import type { AuditLogsRepository } from "@/modules/audit-logs/audit-logs.repository";
import { AuditAction, AuditEntityType } from "@/modules/audit-logs/audit-actions";
import type { ListUsersFilters, PublicUser, UsersRepository } from "./users.repository";
import type { CreateUserDto, UpdateUserDto } from "./users.dto";

export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly auditLogsRepository: AuditLogsRepository,
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
}
