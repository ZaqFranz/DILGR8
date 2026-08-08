import type { Request, Response } from "express";
import type { EvaluationCriteriaService } from "./evaluation-criteria.service";
import type { CreateEvaluationCriterionDto, UpdateEvaluationCriterionDto } from "./evaluation-criteria.dto";

export class EvaluationCriteriaController {
  constructor(private readonly evaluationCriteriaService: EvaluationCriteriaService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const criterion = await this.evaluationCriteriaService.create(req.user!.id, req.body as CreateEvaluationCriterionDto);
    res.status(201).json(criterion);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    // PANEL members only ever need the active rubric to score against;
    // ADMIN sees inactive (retired) criteria too so they can be reactivated.
    const criteria = await this.evaluationCriteriaService.list(req.user!.role === "PANEL");
    res.status(200).json(criteria);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const criterion = await this.evaluationCriteriaService.update(
      req.user!.id,
      req.params.id as string,
      req.body as UpdateEvaluationCriterionDto,
    );
    res.status(200).json(criterion);
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.evaluationCriteriaService.remove(req.user!.id, req.params.id as string);
    res.status(204).send();
  };
}
