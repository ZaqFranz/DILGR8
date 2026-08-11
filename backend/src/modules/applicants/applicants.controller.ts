import type { Request, Response } from "express";
import type { ApplicantsService } from "./applicants.service";
import type {
  CreateApplicantProfileDto,
  CreateAwardDto,
  CreateLdInterventionDto,
  UpdateApplicantProfileDto,
} from "./applicants.dto";

export class ApplicantsController {
  constructor(private readonly applicantsService: ApplicantsService) {}

  getMyProfile = async (req: Request, res: Response): Promise<void> => {
    const profile = await this.applicantsService.getMyProfile(req.user!.id);
    res.status(200).json(profile);
  };

  createProfile = async (req: Request, res: Response): Promise<void> => {
    const profile = await this.applicantsService.createProfile(req.user!.id, req.body as CreateApplicantProfileDto);
    res.status(201).json(profile);
  };

  updateProfile = async (req: Request, res: Response): Promise<void> => {
    const profile = await this.applicantsService.updateProfile(req.user!.id, req.body as UpdateApplicantProfileDto);
    res.status(200).json(profile);
  };

  completeRegistration = async (req: Request, res: Response): Promise<void> => {
    const profile = await this.applicantsService.completeRegistration(req.user!.id);
    res.status(200).json(profile);
  };

  addLdIntervention = async (req: Request, res: Response): Promise<void> => {
    const result = await this.applicantsService.addLdIntervention(req.user!.id, req.body as CreateLdInterventionDto);
    res.status(201).json(result);
  };

  removeLdIntervention = async (req: Request, res: Response): Promise<void> => {
    await this.applicantsService.removeLdIntervention(req.user!.id, req.params.id as string);
    res.status(204).send();
  };

  addAward = async (req: Request, res: Response): Promise<void> => {
    const result = await this.applicantsService.addAward(req.user!.id, req.body as CreateAwardDto);
    res.status(201).json(result);
  };

  removeAward = async (req: Request, res: Response): Promise<void> => {
    await this.applicantsService.removeAward(req.user!.id, req.params.id as string);
    res.status(204).send();
  };
}
