import type { Request, Response } from "express";
import type { PanelEvaluationsService } from "./panel-evaluations.service";
import type { SubmitPanelEvaluationDto } from "./panel-evaluations.dto";

export class PanelEvaluationsController {
  constructor(private readonly panelEvaluationsService: PanelEvaluationsService) {}

  myQueue = async (req: Request, res: Response): Promise<void> => {
    const queue = await this.panelEvaluationsService.myQueue(req.user!.id);
    res.status(200).json(queue);
  };

  submit = async (req: Request, res: Response): Promise<void> => {
    const evaluation = await this.panelEvaluationsService.submit(
      req.params.applicationId as string,
      req.user!.id,
      req.body as SubmitPanelEvaluationDto,
    );
    res.status(200).json(evaluation);
  };

  tabulation = async (req: Request, res: Response): Promise<void> => {
    const result = await this.panelEvaluationsService.tabulation(req.params.jobPostingId as string);
    res.status(200).json(result);
  };

  applicantScoresOverview = async (_req: Request, res: Response): Promise<void> => {
    const result = await this.panelEvaluationsService.applicantScoresOverview();
    res.status(200).json(result);
  };
}
