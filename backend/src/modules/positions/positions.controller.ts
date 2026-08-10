import type { Request, Response } from "express";
import type { PositionsService } from "./positions.service";
import type { CreatePositionDto, UpdatePositionDto } from "./positions.dto";

export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const position = await this.positionsService.create(req.user!.id, req.body as CreatePositionDto);
    res.status(201).json(position);
  };

  list = async (_req: Request, res: Response): Promise<void> => {
    const positions = await this.positionsService.list();
    res.status(200).json(positions);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const position = await this.positionsService.update(
      req.user!.id,
      req.params.id as string,
      req.body as UpdatePositionDto,
    );
    res.status(200).json(position);
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.positionsService.remove(req.user!.id, req.params.id as string);
    res.status(204).send();
  };
}
