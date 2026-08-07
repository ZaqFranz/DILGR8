import type { Request, Response } from "express";
import type { UsersService } from "./users.service";
import type { CreateUserDto, ListUsersQueryDto, UpdateUserDto } from "./users.dto";

export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const users = await this.usersService.list(req.query as ListUsersQueryDto);
    res.status(200).json(users);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const user = await this.usersService.create(req.user!.id, req.body as CreateUserDto);
    res.status(201).json(user);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const user = await this.usersService.update(req.user!.id, req.params.id as string, req.body as UpdateUserDto);
    res.status(200).json(user);
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.usersService.remove(req.user!.id, req.params.id as string);
    res.status(204).send();
  };
}
