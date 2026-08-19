import { ConflictError, NotFoundError } from "@/shared/errors/AppError";
import type { AuditLogsRepository } from "@/modules/audit-logs/audit-logs.repository";
import { AuditAction, AuditEntityType } from "@/modules/audit-logs/audit-actions";
import type { CategoriesRepository, CategoryWithCriteria } from "./categories.repository";
import type { CreateCategoryDto, UpdateCategoryDto } from "./categories.dto";

export class CategoriesService {
  constructor(
    private readonly categoriesRepository: CategoriesRepository,
    private readonly auditLogsRepository: AuditLogsRepository,
  ) {}

  async create(actorUserId: string, dto: CreateCategoryDto): Promise<CategoryWithCriteria> {
    const category = await this.categoriesRepository.create(dto);

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.CATEGORY_CREATED,
      entityType: AuditEntityType.CATEGORY,
      entityId: category.id,
      details: `Added category "${category.name}" (weight ${category.weightPercent}%, ${category.criteria.length} criterion/question(s), ${category.maxScore} raw max pts)`,
    });

    return category;
  }

  async findById(id: string): Promise<CategoryWithCriteria> {
    const category = await this.categoriesRepository.findById(id);
    if (!category) {
      throw new NotFoundError("Category");
    }
    return category;
  }

  list(onlyActive: boolean): Promise<CategoryWithCriteria[]> {
    return this.categoriesRepository.findMany(onlyActive);
  }

  async update(actorUserId: string, id: string, dto: UpdateCategoryDto): Promise<CategoryWithCriteria> {
    const existing = await this.findById(id);
    const updated = await this.categoriesRepository.update(id, dto);

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.CATEGORY_UPDATED,
      entityType: AuditEntityType.CATEGORY,
      entityId: id,
      details: `Updated "${existing.name}": ${JSON.stringify(dto)}`,
    });

    return updated;
  }

  async remove(actorUserId: string, id: string): Promise<void> {
    const existing = await this.findById(id);

    const scoreCount = await this.categoriesRepository.countScores(id);
    if (scoreCount > 0) {
      throw new ConflictError(
        `Cannot delete a category with ${scoreCount} recorded score(s) across its criteria. Deactivate it instead.`,
      );
    }

    await this.categoriesRepository.delete(id);

    await this.auditLogsRepository.record({
      actorUserId,
      action: AuditAction.CATEGORY_DELETED,
      entityType: AuditEntityType.CATEGORY,
      entityId: id,
      details: `Deleted category "${existing.name}"`,
    });
  }
}
