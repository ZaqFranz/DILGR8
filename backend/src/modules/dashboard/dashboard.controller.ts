import type { Request, Response } from "express";
import type { DashboardService } from "./dashboard.service";

export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  summary = async (_req: Request, res: Response): Promise<void> => {
    const summary = await this.dashboardService.getSummary();
    res.status(200).json(summary);
  };
}
