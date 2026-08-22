import type { Request, Response } from "express";
import type { HistoricalHiringDataService } from "./historical-hiring-data.service";
import type {
  CreateHistoricalHiringRecordDto,
  PredictHireQueryDto,
  UpdateHistoricalHiringRecordDto,
} from "./historical-hiring-data.dto";

export class HistoricalHiringDataController {
  constructor(private readonly service: HistoricalHiringDataService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const record = await this.service.create(req.user!.id, req.body as CreateHistoricalHiringRecordDto);
    res.status(201).json(record);
  };

  list = async (_req: Request, res: Response): Promise<void> => {
    const records = await this.service.list();
    res.status(200).json(records);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const record = await this.service.update(req.params.id as string, req.body as UpdateHistoricalHiringRecordDto);
    res.status(200).json(record);
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.service.remove(req.params.id as string);
    res.status(204).send();
  };

  predict = async (req: Request, res: Response): Promise<void> => {
    const { applicationIds } = req.query as unknown as PredictHireQueryDto;
    const predictions = await this.service.predictForApplications(applicationIds);
    res.status(200).json(predictions);
  };
}
