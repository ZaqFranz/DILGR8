import type { Request, Response } from "express";
import type { PanelAssignmentsService } from "./panel-assignments.service";
import type { CreatePanelAssignmentDto, ListPanelAssignmentsQueryDto } from "./panel-assignments.dto";

export class PanelAssignmentsController {
  constructor(private readonly panelAssignmentsService: PanelAssignmentsService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const { jobPostingId } = req.query as ListPanelAssignmentsQueryDto;
    const assignments = await this.panelAssignmentsService.list(jobPostingId);
    res.status(200).json(assignments);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const assignment = await this.panelAssignmentsService.create(req.user!.id, req.body as CreatePanelAssignmentDto);
    res.status(201).json(assignment);
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.panelAssignmentsService.remove(req.user!.id, req.params.id as string);
    res.status(204).send();
  };
}
