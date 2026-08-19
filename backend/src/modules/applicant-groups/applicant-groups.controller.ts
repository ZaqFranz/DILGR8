import type { Request, Response } from "express";
import type { ApplicantGroupsService } from "./applicant-groups.service";
import type { CreateApplicantGroupDto, UpdateApplicantGroupDto } from "./applicant-groups.dto";

export class ApplicantGroupsController {
  constructor(private readonly applicantGroupsService: ApplicantGroupsService) {}

  list = async (_req: Request, res: Response): Promise<void> => {
    const groups = await this.applicantGroupsService.list();
    res.status(200).json(groups);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const group = await this.applicantGroupsService.create(req.user!.id, req.body as CreateApplicantGroupDto);
    res.status(201).json(group);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const group = await this.applicantGroupsService.update(
      req.user!.id,
      req.params.id as string,
      req.body as UpdateApplicantGroupDto,
    );
    res.status(200).json(group);
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.applicantGroupsService.remove(req.user!.id, req.params.id as string);
    res.status(204).send();
  };
}
