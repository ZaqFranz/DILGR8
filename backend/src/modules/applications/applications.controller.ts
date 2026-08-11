import type { Request, Response } from "express";
import { z } from "zod";
import { ValidationError } from "@/shared/errors/AppError";
import type { ApplicationsService } from "./applications.service";
import { createApplicationSchema } from "./applications.dto";
import type {
  ListApplicationsQueryDto,
  ReviewComplianceItemDto,
  ScheduleInterviewDto,
  ScheduleOathTakingDto,
  SetExamScoreDto,
  SiftApplicationDto,
} from "./applications.dto";

const importExamScoresFieldsSchema = z.object({
  jobPostingId: z.string().uuid().optional(),
});

export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  // Manual parse rather than the validate() middleware: this route now
  // carries the Application Letter as multipart/form-data (like
  // importExamScores below), and validate() runs before multer has parsed
  // the body into req.body.
  submit = async (req: Request, res: Response): Promise<void> => {
    const parsed = createApplicationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid application fields", parsed.error.flatten());
    }
    if (!req.file) {
      throw new ValidationError("An Application Letter is required to submit an application");
    }
    const application = await this.applicationsService.submit(
      req.user!.id,
      parsed.data.jobPostingId,
      req.user!.email,
      req.file,
    );
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

  exportPendingPqeScores = async (req: Request, res: Response): Promise<void> => {
    const { jobPostingId } = req.query as ListApplicationsQueryDto;
    const buffer = await this.applicationsService.exportPendingPqeScores(jobPostingId);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="pending-pqe-scores.xlsx"');
    res.send(buffer);
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

  setExamScore = async (req: Request, res: Response): Promise<void> => {
    const application = await this.applicationsService.setExaminationScore(
      req.params.id as string,
      req.user!.id,
      req.body as SetExamScoreDto,
    );
    res.status(200).json(application);
  };

  scheduleInterview = async (req: Request, res: Response): Promise<void> => {
    const application = await this.applicationsService.scheduleInterview(
      req.params.id as string,
      req.user!.id,
      req.body as ScheduleInterviewDto,
    );
    res.status(200).json(application);
  };

  moveToCompliance = async (req: Request, res: Response): Promise<void> => {
    const application = await this.applicationsService.moveToCompliance(req.params.id as string, req.user!.id);
    res.status(200).json(application);
  };

  listComplianceItems = async (req: Request, res: Response): Promise<void> => {
    const items = await this.applicationsService.listComplianceItems(req.params.id as string, {
      id: req.user!.id,
      role: req.user!.role,
    });
    res.status(200).json(items);
  };

  reviewComplianceItem = async (req: Request, res: Response): Promise<void> => {
    const item = await this.applicationsService.reviewComplianceItem(
      req.params.id as string,
      req.params.itemId as string,
      req.user!.id,
      req.body as ReviewComplianceItemDto,
    );
    res.status(200).json(item);
  };

  scheduleOathTaking = async (req: Request, res: Response): Promise<void> => {
    const application = await this.applicationsService.scheduleOathTaking(
      req.params.id as string,
      req.user!.id,
      req.body as ScheduleOathTakingDto,
    );
    res.status(200).json(application);
  };

  markHired = async (req: Request, res: Response): Promise<void> => {
    const application = await this.applicationsService.markHired(req.params.id as string, req.user!.id);
    res.status(200).json(application);
  };
}
