import type { ApplicationStatus } from "@prisma/client";
import { ForbiddenError, NotFoundError, ValidationError } from "@/shared/errors/AppError";
import type { CategoriesRepository, CategoryWithCriteria } from "@/modules/categories/categories.repository";
import type { PanelAssignmentsRepository } from "@/modules/panel-assignments/panel-assignments.repository";
import type { AuditLogsRepository } from "@/modules/audit-logs/audit-logs.repository";
import { AuditAction, AuditEntityType } from "@/modules/audit-logs/audit-actions";
import type {
  ApplicationForInterviewQueue,
  ApplicationForScoresOverview,
  PanelEvaluationsRepository,
  PanelEvaluationWithScores,
} from "./panel-evaluations.repository";
import type { SubmitPanelEvaluationDto } from "./panel-evaluations.dto";

export interface TabulationRow {
  applicationId: string;
  applicantName: string;
  perPanelist: Record<string, number | null>;
  average: number | null;
  rank: number | null;
  panelistsSubmitted: number;
  panelistsAssigned: number;
}

export interface TabulationResult {
  panelists: { id: string; email: string }[];
  rows: TabulationRow[];
}

export interface ApplicantScoreCategoryColumn {
  id: string;
  name: string;
  // The weight (0-100), not the raw point total - this is the ceiling the
  // weighted per-category number below can actually reach.
  weightPercent: number;
}

export interface ApplicantScoreCriterionColumn {
  id: string;
  categoryId: string;
  name: string;
  // Raw max (0-maxScore), not a weighted figure - unlike a category, a
  // criterion has no weightPercent of its own; it only ever contributes to
  // its parent category's weighted total (see weightedCategoryScore).
  maxScore: number;
}

export interface ApplicantScoreRow {
  applicationId: string;
  applicantName: string;
  jobPostingTitle: string;
  // The job posting's recruitment publication round/batch (e.g. "ROS-1") -
  // lets Report Summary's Publication filter narrow the table the same way
  // EvaluateApplicantsPage's own Publication filter narrows its list.
  jobPostingPublication: string;
  // The application's current pipeline status (not necessarily still
  // FOR_INTERVIEW - it may have moved on to Compliance, Oath-Taking, HIRED,
  // or a rejected/withdrawn status since it was scored). Report Summary is
  // a historical record of interview results, not a worklist, so it
  // deliberately doesn't filter these out - see findApplicationsWithScores().
  status: ApplicationStatus;
  perCategory: Record<string, number | null>;
  // Raw (not weighted) average score per criterion, across however many
  // panelists actually scored this application - combined across every
  // panelist, never any one panelist's individual number (see Report
  // Summary page).
  perCriterion: Record<string, number | null>;
  total: number | null;
  panelistsSubmitted: number;
  // How many panelists are assigned to this application's job posting
  // (cross-posting, so unlike tabulation() this is looked up per-row via
  // its own jobPostingId rather than being a single fixed count) - the
  // denominator Report Summary's "submitted/assigned" figure needs, since
  // panelistsSubmitted alone doesn't say whether scoring is complete.
  panelistsAssigned: number;
}

export interface ApplicantScoresOverview {
  categories: ApplicantScoreCategoryColumn[];
  criteria: ApplicantScoreCriterionColumn[];
  rows: ApplicantScoreRow[];
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * A category is worth exactly `weightPercent` of the overall evaluation,
 * no matter how many criteria it has or what their point values sum to
 * (client requirement: "even I have many criteria max point should still
 * be 25% of the overall evaluation"). A panelist's raw subtotal for the
 * category - the sum of their scores across just that category's own
 * criteria - is normalized against the category's raw max (the sum of its
 * active criteria's own `maxScore`, i.e. `category.maxScore`) and then
 * scaled to `weightPercent`. A category with no active criteria (nothing
 * to normalize against) contributes 0 regardless of its weight.
 */
export function weightedCategoryScore(rawSubtotal: number, rawMax: number, weightPercent: number): number {
  return rawMax > 0 ? (rawSubtotal / rawMax) * weightPercent : 0;
}

function rawSubtotalForCriteria(evaluation: PanelEvaluationWithScores, criterionIds: ReadonlySet<string>): number {
  return evaluation.scores.filter((s) => criterionIds.has(s.criterionId)).reduce((sum, s) => sum + s.score, 0);
}

/**
 * One panelist's raw score for one criterion, or null if they never scored
 * it - normally unreachable for an active criterion (submit() requires
 * every active criterion to be scored), but a criterion activated after an
 * older evaluation was already submitted would leave exactly this gap, so
 * it's treated as "no data" here rather than assumed to be 0.
 */
function rawScoreForCriterion(evaluation: PanelEvaluationWithScores, criterionId: string): number | null {
  return evaluation.scores.find((s) => s.criterionId === criterionId)?.score ?? null;
}

/** categoryId -> the set of that category's own criterion ids, precomputed once per request rather than per evaluation/category pair. */
export function buildCriterionIdsByCategory(categories: CategoryWithCriteria[]): Map<string, Set<string>> {
  return new Map(categories.map((category) => [category.id, new Set(category.criteria.map((c) => c.id))]));
}

/**
 * A panelist's overall score for one application: the sum of their
 * weighted per-category contributions (see weightedCategoryScore above),
 * not a flat sum of every raw PanelScore - a category with a high raw
 * point total no longer outweighs one with a low raw total just because it
 * has more/bigger criteria, as long as both carry the same weightPercent.
 * If every active category's weightPercent adds up to 100, this is a
 * score out of 100; the app doesn't enforce that sum (a soft-check UI hint
 * only), so it's on the admin to keep weights meaningful together.
 */
export function weightedTotalScore(
  evaluation: PanelEvaluationWithScores,
  categories: CategoryWithCriteria[],
  criterionIdsByCategory: Map<string, Set<string>>,
): number {
  return categories.reduce((sum, category) => {
    const criterionIds = criterionIdsByCategory.get(category.id) ?? new Set<string>();
    const rawSubtotal = rawSubtotalForCriteria(evaluation, criterionIds);
    return sum + weightedCategoryScore(rawSubtotal, category.maxScore, category.weightPercent);
  }, 0);
}

/**
 * Assigns standard competition ranks (1224...) to `rows` by descending
 * `average`, mutating each row's `rank` in place: rows with an equal
 * average share the same rank, and the next distinct average's rank is its
 * 1-based position in the sorted order - not "previous rank + 1", which
 * would break ties arbitrarily by array order instead of ranking them the
 * same. Rows with a null average (nothing to rank) are left with `rank:
 * null` and excluded from the ranking entirely. Exported standalone so it
 * can be unit-tested without spinning up the full service.
 */
export function assignCompetitionRanks<T extends { average: number | null; rank: number | null }>(rows: T[]): T[] {
  const ranked = [...rows].sort((a, b) => (b.average ?? -1) - (a.average ?? -1));
  let previousAverage: number | null = null;
  ranked.forEach((row, index) => {
    if (row.average === null) return;
    row.rank = row.average === previousAverage ? ranked[index - 1]!.rank : index + 1;
    previousAverage = row.average;
  });
  return rows;
}

export class PanelEvaluationsService {
  constructor(
    private readonly panelEvaluationsRepository: PanelEvaluationsRepository,
    private readonly panelAssignmentsRepository: PanelAssignmentsRepository,
    private readonly categoriesRepository: CategoriesRepository,
    private readonly auditLogsRepository: AuditLogsRepository,
  ) {}

  async myQueue(panelUserId: string): Promise<ApplicationForInterviewQueue[]> {
    const assignments = await this.panelAssignmentsRepository.findJobPostingIdsForPanelUser(panelUserId);
    const jobPostingIds = assignments.map((a) => a.jobPostingId);
    return this.panelEvaluationsRepository.findQueueForPanelUser(jobPostingIds, panelUserId);
  }

  async submit(applicationId: string, panelUserId: string, dto: SubmitPanelEvaluationDto): Promise<PanelEvaluationWithScores> {
    const application = await this.panelEvaluationsRepository.findApplicationById(applicationId);
    if (!application) {
      throw new NotFoundError("Application");
    }
    if (application.status !== "FOR_INTERVIEW") {
      throw new ValidationError("This application is not currently in the interview stage");
    }
    // Belt-and-suspenders: scheduleInterview() already requires a recorded
    // PQE score before an application can reach FOR_INTERVIEW, so this
    // should be unreachable in practice - kept as an explicit guard so panel
    // scoring never depends solely on that earlier gate holding.
    if (application.examinationScore === null) {
      throw new ValidationError("Cannot score this applicant until a PQE exam score has been recorded");
    }
    // Client requirement: an applicant already scored on another of their
    // applications shouldn't be evaluated again here - findQueueForPanelUser
    // already excludes these from the queue, this is the defensive backstop
    // in case a panelist still has a stale link to a since-linked applicationId.
    if (application.scoreSourceApplicationId !== null) {
      throw new ValidationError(
        "This applicant's interview score is carried over from another job posting and does not need a separate evaluation here",
      );
    }
    // The stored scoreSourceApplicationId above only catches links made
    // *before* this application's queue entry was fetched - two panelists on
    // two different postings can each open their queue, both see this
    // applicant as unscored, and both attempt to submit around the same
    // time. reconcileScoreSource() re-checks live, right before writing a
    // score, whether some other of the applicant's applications has since
    // been scored (by either panel) and links this one to it if so, closing
    // that window instead of allowing a second independent evaluation.
    const alreadyScoredElsewhere = await this.panelEvaluationsRepository.reconcileScoreSource(
      applicationId,
      application.applicantId,
    );
    if (alreadyScoredElsewhere) {
      throw new ValidationError(
        "This applicant's interview score is carried over from another job posting and does not need a separate evaluation here",
      );
    }

    const assignment = await this.panelAssignmentsRepository.findByPostingAndPanelUser(
      application.jobPostingId,
      panelUserId,
    );
    if (!assignment) {
      throw new ForbiddenError("You are not assigned to this posting's interview panel");
    }

    // A panelist scores every active Criterion (the scored leaf), not the
    // Category it belongs to - a category is never scored directly.
    const activeCategories = await this.categoriesRepository.findMany(true);
    const activeCriteria = activeCategories.flatMap((category) =>
      category.criteria.map((criterion) => ({ ...criterion, categoryName: category.name })),
    );
    const criteriaById = new Map(activeCriteria.map((c) => [c.id, c]));

    const missing = activeCriteria.filter((c) => !dto.scores.some((s) => s.criterionId === c.id));
    if (missing.length > 0) {
      throw new ValidationError(`Missing score(s) for: ${missing.map((c) => `${c.categoryName} - ${c.name}`).join(", ")}`);
    }
    for (const score of dto.scores) {
      const criterion = criteriaById.get(score.criterionId);
      if (!criterion) {
        throw new ValidationError("Score submitted for an unknown or inactive criterion/question");
      }
      if (score.score > criterion.maxScore) {
        throw new ValidationError(`Score for "${criterion.categoryName} - ${criterion.name}" cannot exceed ${criterion.maxScore}`);
      }
    }

    const evaluation = await this.panelEvaluationsRepository.upsertEvaluation(applicationId, panelUserId, {
      remarks: dto.remarks,
      scores: dto.scores,
    });

    // This application just got its own real score (the guard above already
    // ruled out it being an inheriting one), so it's now the canonical
    // source any of the applicant's other open, unscored applications
    // should carry this score forward to - avoids a redundant interview on
    // every other posting they've applied to.
    await this.panelEvaluationsRepository.linkSiblingScoreSources(application.applicantId, applicationId);

    const weightedTotal = weightedTotalScore(evaluation, activeCategories, buildCriterionIdsByCategory(activeCategories));
    await this.auditLogsRepository.record({
      actorUserId: panelUserId,
      action: AuditAction.PANEL_EVALUATION_SUBMITTED,
      entityType: AuditEntityType.PANEL_EVALUATION,
      entityId: evaluation.id,
      details: `Submitted interview scores for application ${applicationId}: ${weightedTotal.toFixed(1)} weighted total`,
    });

    return evaluation;
  }

  async tabulation(jobPostingId: string): Promise<TabulationResult> {
    const [assignments, applications, categories] = await Promise.all([
      this.panelAssignmentsRepository.findMany(jobPostingId),
      this.panelEvaluationsRepository.findApplicationsForTabulation(jobPostingId),
      this.categoriesRepository.findMany(true),
    ]);

    const panelists = assignments.map((a) => a.panelUser);
    const panelUserIds = panelists.map((p) => p.id);
    const criterionIdsByCategory = buildCriterionIdsByCategory(categories);

    const rows: TabulationRow[] = applications.map((application) => {
      const perPanelist: Record<string, number | null> = {};
      let sum = 0;
      let submitted = 0;
      for (const panelUserId of panelUserIds) {
        const evaluation = application.panelEvaluations.find((e) => e.panelUserId === panelUserId);
        if (evaluation) {
          const total = weightedTotalScore(evaluation, categories, criterionIdsByCategory);
          perPanelist[panelUserId] = total;
          sum += total;
          submitted += 1;
        } else {
          perPanelist[panelUserId] = null;
        }
      }
      return {
        applicationId: application.id,
        applicantName: `${application.applicant.firstName} ${application.applicant.lastName}`,
        perPanelist,
        average: submitted > 0 ? sum / submitted : null,
        rank: null,
        panelistsSubmitted: submitted,
        panelistsAssigned: panelUserIds.length,
      };
    });

    assignCompetitionRanks(rows);

    return { panelists, rows };
  }

  /**
   * Cross-posting view for the admin's "Applicant Scores" modal (Categories
   * page) and the Report Summary page: every scored application's average
   * *weighted* score per active Category, its average *raw* score per
   * active Criterion, and its overall average weighted total - "average"
   * because more than one panelist may have scored the same application
   * differently, and a missing panelist just means fewer values going into
   * that average rather than blocking it (see PanelScore/Criterion docs).
   * A category's value here is the panelists' weighted contribution (raw
   * subtotal across the category's own criteria, normalized to the
   * category's weightPercent) - never a raw point sum, so a category with
   * many high-point criteria doesn't outrank one with a single low-point
   * criterion at the same weight. A criterion's value is its raw average
   * score instead (0-maxScore) - a criterion has no weight of its own to
   * normalize against, it only ever feeds into its parent category's
   * weighted figure. Deliberately never broken down by individual
   * panelist here (see Report Summary page: an admin sees the combined
   * result, not who scored what) - that per-panelist detail exists only in
   * tabulation() above, which is the CompAss ranking view, not this one.
   */
  async applicantScoresOverview(): Promise<ApplicantScoresOverview> {
    const [categories, applications, assignments] = await Promise.all([
      this.categoriesRepository.findMany(true),
      this.panelEvaluationsRepository.findApplicationsWithScores(),
      this.panelAssignmentsRepository.findMany(),
    ]);

    const assignedCountByJobPosting = new Map<string, number>();
    for (const assignment of assignments) {
      assignedCountByJobPosting.set(
        assignment.jobPostingId,
        (assignedCountByJobPosting.get(assignment.jobPostingId) ?? 0) + 1,
      );
    }

    const criterionIdsByCategory = buildCriterionIdsByCategory(categories);
    const allCriteria = categories.flatMap((category) =>
      category.criteria.map((criterion) => ({ ...criterion, categoryId: category.id })),
    );

    const rows: ApplicantScoreRow[] = applications.map((application: ApplicationForScoresOverview) => {
      const perCategory: Record<string, number | null> = {};
      for (const category of categories) {
        const criterionIds = criterionIdsByCategory.get(category.id) ?? new Set<string>();
        const weightedScores = application.panelEvaluations.map((evaluation) =>
          weightedCategoryScore(rawSubtotalForCriteria(evaluation, criterionIds), category.maxScore, category.weightPercent),
        );
        perCategory[category.id] = average(weightedScores);
      }
      const perCriterion: Record<string, number | null> = {};
      for (const criterion of allCriteria) {
        const scores = application.panelEvaluations
          .map((evaluation) => rawScoreForCriterion(evaluation, criterion.id))
          .filter((score): score is number => score !== null);
        perCriterion[criterion.id] = average(scores);
      }
      return {
        applicationId: application.id,
        applicantName: `${application.applicant.firstName} ${application.applicant.lastName}`,
        jobPostingTitle: application.jobPosting.title,
        jobPostingPublication: application.jobPosting.publication,
        status: application.status,
        perCategory,
        perCriterion,
        total: average(application.panelEvaluations.map((e) => weightedTotalScore(e, categories, criterionIdsByCategory))),
        panelistsSubmitted: application.panelEvaluations.length,
        panelistsAssigned: assignedCountByJobPosting.get(application.jobPostingId) ?? 0,
      };
    });

    return {
      categories: categories.map((c) => ({ id: c.id, name: c.name, weightPercent: c.weightPercent })),
      criteria: allCriteria.map((c) => ({ id: c.id, categoryId: c.categoryId, name: c.name, maxScore: c.maxScore })),
      rows,
    };
  }
}
