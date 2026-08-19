import type { Request, Response } from "express";
import type { CategoriesService } from "./categories.service";
import type { CreateCategoryDto, UpdateCategoryDto } from "./categories.dto";

export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const category = await this.categoriesService.create(req.user!.id, req.body as CreateCategoryDto);
    res.status(201).json(category);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    // PANEL members only ever need the active rubric to score against;
    // ADMIN sees inactive (retired) categories too so they can be reactivated.
    const categories = await this.categoriesService.list(req.user!.role === "PANEL");
    res.status(200).json(categories);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const category = await this.categoriesService.update(
      req.user!.id,
      req.params.id as string,
      req.body as UpdateCategoryDto,
    );
    res.status(200).json(category);
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await this.categoriesService.remove(req.user!.id, req.params.id as string);
    res.status(204).send();
  };
}
