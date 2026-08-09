import type { Request, Response } from "express";
import { z } from "zod";
import { ValidationError } from "@/shared/errors/AppError";
import type { ApplicationsService } from "./applications.service";
import type {
  CreateApplicationDto,
  ListApplicationsQueryDto,
  ScheduleInterviewDto,
  SiftApplicationDto,
} from "./applications.dto";

const importExamScoresFieldsSchema = z.object({
  jobPostingId: z.string().uuid(),
});

export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  submit = async (req: Request, res: Response): Promise<void> => {
    const { jobPostingId } = req.body as CreateApplicationDto;
    const application = await this.applicationsService.submit(req.user!.id, jobPostingId, req.user!.email);
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

  withdraw = async (req: Request, res: Response): Promise<void> => {
    const application = await this.applicationsService.withdraw(req.params.id as string, req.user!.id);
    res.status(200).json(application);
  };

  sift = async (req: Request, res: Response): Promise<void> => {
    const application = await this.applicationsService.sift(
      req.params.id as string,
      req.user!.id,
      req.body as SiftApplicationDto,
    );
    res.status(200).json(application);
  };

  importExamScores = async (req: Request, res: Response): Promise<void> => {
    const parsed = importExamScoresFieldsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid exam score import fields", parsed.error.flatten());
    }
    if (!req.file) {
      throw new ValidationError("An XLSX or XLS file is required");
    }
    const result = await this.applicationsService.importExaminationScores(
      parsed.data.jobPostingId,
      req.user!.id,
      req.file.buffer,
    );
    res.status(200).json(result);
  };

  scheduleInterview = async (req: Request, res: Response): Promise<void> => {
    const application = await this.applicationsService.scheduleInterview(
      req.params.id as string,
      req.user!.id,
      req.body as ScheduleInterviewDto,
    );
    res.status(200).json(application);
  };
}
