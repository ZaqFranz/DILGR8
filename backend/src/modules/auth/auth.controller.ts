import type { Request, Response } from "express";
import type { AuthService } from "./auth.service";
import type { LoginDto, RegisterDto } from "./auth.dto";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const result = await this.authService.register(req.body as RegisterDto);
    res.status(201).json(result);
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const result = await this.authService.login(req.body as LoginDto);
    res.status(200).json(result);
  };
}
