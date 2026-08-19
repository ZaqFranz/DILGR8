import type { Category, Criterion, Prisma, PrismaClient } from "@prisma/client";
import { ConflictError } from "@/shared/errors/AppError";
import type { CreateCategoryDto, UpdateCategoryDto } from "./categories.dto";

export type CategoryWithCriteria = Category & { criteria: Criterion[]; maxScore: number };

const criteriaOrder = { orderBy: { sortOrder: "asc" as const } };

/** Sum of a category's own *active* criteria - the raw scale a panelist actually fills in scores against. Not the category's contribution to the overall evaluation - that's `weightPercent` (a real stored column), which a panelist's raw subtotal here gets normalized against (see PanelEvaluationsService). */
function attachMaxScore<T extends { criteria: Criterion[] }>(category: T): T & { maxScore: number } {
  return { ...category, maxScore: category.criteria.filter((c) => c.isActive).reduce((sum, c) => sum + c.maxScore, 0) };
}

export class CategoriesRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateCategoryDto): Promise<CategoryWithCriteria> {
    const category = await this.db.category.create({
      data: {
        name: input.name,
        weightPercent: input.weightPercent,
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        criteria: {
          create: (input.criteria ?? []).map((c, index) => ({
            name: c.name,
            maxScore: c.maxScore,
            sortOrder: c.sortOrder ?? index,
            isActive: c.isActive ?? true,
          })),
        },
      },
      include: { criteria: criteriaOrder },
    });
    return attachMaxScore(category);
  }

  async findById(id: string): Promise<CategoryWithCriteria | null> {
    const category = await this.db.category.findUnique({ where: { id }, include: { criteria: criteriaOrder } });
    return category ? attachMaxScore(category) : null;
  }

  async findMany(onlyActive: boolean): Promise<CategoryWithCriteria[]> {
    const categories = await this.db.category.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      include: { criteria: { where: onlyActive ? { isActive: true } : undefined, orderBy: { sortOrder: "asc" } } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return categories.map(attachMaxScore);
  }

  async update(id: string, data: UpdateCategoryDto): Promise<CategoryWithCriteria> {
    const { criteria, ...categoryFields } = data;
    const category = await this.db.$transaction(async (tx) => {
      await tx.category.update({ where: { id }, data: categoryFields });
      if (criteria !== undefined) {
        await this.replaceCriteria(tx, id, criteria);
      }
      return tx.category.findUniqueOrThrow({ where: { id }, include: { criteria: criteriaOrder } });
    });
    return attachMaxScore(category);
  }

  /**
   * Diffs the incoming criteria list against what's on file instead of the
   * old questions convention's blind delete+recreate - a Criterion can now
   * carry real historical PanelScore rows, so silently dropping one that
   * has scores would orphan/destroy a panelist's mark. Items with an `id`
   * update that row in place; items without one are created; anything on
   * file but missing from the incoming list is removed *unless* it already
   * has scores, in which case the whole update is rejected (409) - same
   * "deactivate instead" guidance the top-level delete guards already give.
   */
  private async replaceCriteria(
    tx: Prisma.TransactionClient,
    categoryId: string,
    incoming: NonNullable<UpdateCategoryDto["criteria"]>,
  ): Promise<void> {
    const existing = await tx.criterion.findMany({
      where: { categoryId },
      include: { _count: { select: { scores: true } } },
    });
    const incomingIds = new Set(incoming.filter((c) => c.id).map((c) => c.id!));
    const toRemove = existing.filter((e) => !incomingIds.has(e.id));
    const blocked = toRemove.filter((e) => e._count.scores > 0);
    if (blocked.length > 0) {
      throw new ConflictError(
        `Cannot remove "${blocked.map((b) => b.name).join('", "')}" - it already has recorded score(s). Deactivate it instead.`,
      );
    }
    if (toRemove.length > 0) {
      await tx.criterion.deleteMany({ where: { id: { in: toRemove.map((e) => e.id) } } });
    }
    for (const [index, c] of incoming.entries()) {
      const fields = { name: c.name, maxScore: c.maxScore, sortOrder: c.sortOrder ?? index, isActive: c.isActive ?? true };
      if (c.id) {
        await tx.criterion.update({ where: { id: c.id }, data: fields });
      } else {
        await tx.criterion.create({ data: { categoryId, ...fields } });
      }
    }
  }

  delete(id: string): Promise<Category> {
    return this.db.category.delete({ where: { id } });
  }

  /** Every recorded score across this category's criteria - the delete guard checks this, not just the category row itself, since scores now live one level down. */
  countScores(categoryId: string): Promise<number> {
    return this.db.panelScore.count({ where: { criterion: { categoryId } } });
  }
}
