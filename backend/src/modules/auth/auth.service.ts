import type { Role } from "@prisma/client";
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from "@/shared/errors/AppError";
import { generateTemporaryPassword, hashPassword, verifyPassword } from "@/shared/utils/password";
import { signAccessToken } from "@/shared/utils/jwt";
import type { EmailService } from "@/shared/email/emailService";
import { temporaryPasswordEmail } from "@/shared/email/authEmailTemplates";
import type { AuditLogsRepository } from "@/modules/audit-logs/audit-logs.repository";
import { AuditAction, AuditEntityType } from "@/modules/audit-logs/audit-actions";
import type { AuthRepository } from "./auth.repository";
import type { AuthResponseDto, ChangePasswordDto, ForgotPasswordDto, LoginDto, RegisterDto } from "./auth.dto";

export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly auditLogsRepository: AuditLogsRepository,
    private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.authRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictError("An account with this email already exists");
    }

    const passwordHash = await hashPassword(dto.password);
    const user = await this.authRepository.create(dto.email, passwordHash);

    return this.buildAuthResponse(user.id, user.email, user.role, user.mustChangePassword, user.tokenVersion);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.authRepository.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const valid = await verifyPassword(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    return this.buildAuthResponse(user.id, user.email, user.role, user.mustChangePassword, user.tokenVersion);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.authRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User");
    }

    const valid = await verifyPassword(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new ValidationError("Current password is incorrect", {
        fieldErrors: { currentPassword: ["Current password is incorrect"] },
      });
    }

    const passwordHash = await hashPassword(dto.newPassword);
    await this.authRepository.updatePassword(userId, passwordHash);
  }

  /**
   * Issues a temporary password by email. Scoped to APPLICANT accounts only
   * - this is a self-service applicant recovery path, not a general admin
   * account-reset tool (see docs/decisions.md). Silently no-ops for unknown
   * emails and non-applicant accounts alike, and always returns the same
   * generic outcome to the caller, so this endpoint can't be used to probe
   * which emails have accounts or to force-reset an admin/panel password.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.authRepository.findByEmailWithApplicant(dto.email);
    if (!user || user.role !== "APPLICANT") {
      return;
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    await this.authRepository.setTemporaryPassword(user.id, passwordHash);

    await this.auditLogsRepository.record({
      actorUserId: user.id,
      action: AuditAction.USER_TEMPORARY_PASSWORD_ISSUED,
      entityType: AuditEntityType.USER,
      entityId: user.id,
      details: `Temporary password issued to ${user.email} via forgot-password`,
    });

    const applicantName = user.applicant ? `${user.applicant.firstName} ${user.applicant.lastName}` : user.email;
    const { subject, html } = temporaryPasswordEmail(applicantName, temporaryPassword);
    await this.emailService.send({ to: user.email, subject, html });
  }

  private buildAuthResponse(
    id: string,
    email: string,
    role: Role,
    mustChangePassword: boolean,
    tokenVersion: number,
  ): AuthResponseDto {
    const accessToken = signAccessToken({ sub: id, email, role, tokenVersion });
    return { accessToken, user: { id, email, role, mustChangePassword } };
  }
}
