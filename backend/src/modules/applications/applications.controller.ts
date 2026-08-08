import type { Request, Response } from "express";
import type { ApplicationsService } from "./applications.service";
import type { CreateApplicationDto, EvaluateApplicationDto, ListApplicationsQueryDto } from "./applications.dto";

export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  submit = async (req: Request, res: Response): Promise<void> => {
    const { jobPostingId } = req.body as CreateApplicationDto;
    const application = await this.applicationsService.submit(req.user!.id, jobPostingId);
    res.status(201).json(application);
  };

  listMine = async (req: Request, res: Response): Promise<void> => {
    const applications = await this.applicationsService.listMine(req.user!.id);
    res.status(200).json(applications);
  };

  listForAdmin = async (req: Request, res: Response): Promise<void> => {
    const { jobPostingId } = req.query as ListApplicationsQueryDto;
    const applications = await this.applicationsService.listForAdmin(jobPostingId);
    res.status(200).json(applications);
  };

  evaluate = async (req: Request, res: Response): Promise<void> => {
    const application = await this.applicationsService.evaluate(
      req.params.id as string,
      req.user!.id,
      req.body as EvaluateApplicationDto,
    );
    res.status(200).json(application);
  };

  scheduleInterview = async (req: Request, res: Response): Promise<void> => {
    const application = await this.applicationsService.scheduleInterview(req.params.id as string, req.user!.id);
    res.status(200).json(application);
  };
}
