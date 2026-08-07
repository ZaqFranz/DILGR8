import type { Request, Response } from "express";
import type { JobPostingsService } from "./job-postings.service";
import type { CreateJobPostingDto, ListJobPostingsQueryDto, UpdateJobPostingDto } from "./job-postings.dto";

export class JobPostingsController {
  constructor(private readonly jobPostingsService: JobPostingsService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const posting = await this.jobPostingsService.create(req.user!.id, req.body as CreateJobPostingDto);
    res.status(201).json(posting);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const { status } = req.query as ListJobPostingsQueryDto;
    const postings = await this.jobPostingsService.list(status);
    res.status(200).json(postings);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const posting = await this.jobPostingsService.findById(req.params.id as string);
    res.status(200).json(posting);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const posting = await this.jobPostingsService.update(
      req.user!.id,
      req.params.id as string,
      req.body as UpdateJobPostingDto,
    );
    res.status(200).json(posting);
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.jobPostingsService.remove(req.user!.id, req.params.id as string);
    res.status(204).send();
  };
}
