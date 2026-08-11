import type { Request, Response } from "express";
import type { ComplianceRequirementsService } from "./compliance-requirements.service";
import type { CreateComplianceRequirementDto, UpdateComplianceRequirementDto } from "./compliance-requirements.dto";

export class ComplianceRequirementsController {
  constructor(private readonly complianceRequirementsService: ComplianceRequirementsService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const requirement = await this.complianceRequirementsService.create(
      req.user!.id,
      req.body as CreateComplianceRequirementDto,
    );
    res.status(201).json(requirement);
  };

  list = async (_req: Request, res: Response): Promise<void> => {
    const requirements = await this.complianceRequirementsService.list(false);
    res.status(200).json(requirements);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const requirement = await this.complianceRequirementsService.update(
      req.user!.id,
      req.params.id as string,
      req.body as UpdateComplianceRequirementDto,
    );
    res.status(200).json(requirement);
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.complianceRequirementsService.remove(req.user!.id, req.params.id as string);
    res.status(204).send();
  };
}
