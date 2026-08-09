import type { Role } from "@prisma/client";
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from "@/shared/errors/AppError";
import { hashPassword, verifyPassword } from "@/shared/utils/password";
import { signAccessToken } from "@/shared/utils/jwt";
import type { AuthRepository } from "./auth.repository";
import type { AuthResponseDto, ChangePasswordDto, LoginDto, RegisterDto } from "./auth.dto";

export class AuthService {
  constructor(private readonly authRepository: AuthRepository) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existing = await this.authRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictError("An account with this email already exists");
    }

    const passwordHash = await hashPassword(dto.password);
    const user = await this.authRepository.create(dto.email, passwordHash);

    return this.buildAuthResponse(user.id, user.email, user.role);
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

    return this.buildAuthResponse(user.id, user.email, user.role);
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

  private buildAuthResponse(id: string, email: string, role: Role): AuthResponseDto {
    const accessToken = signAccessToken({ sub: id, email, role });
    return { accessToken, user: { id, email, role } };
  }
}
