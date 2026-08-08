import type { Role } from "@prisma/client";
import { ConflictError, UnauthorizedError } from "@/shared/errors/AppError";
import { hashPassword, verifyPassword } from "@/shared/utils/password";
import { signAccessToken } from "@/shared/utils/jwt";
import type { AuthRepository } from "./auth.repository";
import type { AuthResponseDto, LoginDto, RegisterDto } from "./auth.dto";

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

  private buildAuthResponse(id: string, email: string, role: Role): AuthResponseDto {
    const accessToken = signAccessToken({ sub: id, email, role });
    return { accessToken, user: { id, email, role } };
  }
}
