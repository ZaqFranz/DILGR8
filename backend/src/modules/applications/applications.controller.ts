import type { Request, Response } from "express";
import type { ApplicationsService } from "./applications.service";
import type { CreateApplicationDto } from "./applications.dto";

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
}
