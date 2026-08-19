-- Renames the Evaluation Criteria rubric into a two-level Category ->
-- Criterion structure, per client request: "Evaluation Criteria" becomes
-- "Categories", and each category's guiding "questions" become individually
-- scored "criteria/question" line items with their own point value.
--
-- Data for `evaluation_criterion_questions` (now `criteria`) was already
-- reshaped by a one-off pre-migration script before this file was written:
-- every row now has a real `maxScore`/`isActive`, and any category that had
-- already been scored under the old whole-category model was collapsed to
-- one fallback criterion carrying its full point value, with the existing
-- panel_scores row(s) repointed to it - see docs/decisions.md's entry for
-- this change for the full rationale. This migration only does the
-- structural rename; it deliberately uses RENAME TABLE / CHANGE COLUMN
-- instead of Prisma's default DROP+CREATE diff so no data is lost.

-- Category (was EvaluationCriterion): drop maxScore - now derived as the
-- sum of the category's active criteria, computed at read time instead of
-- stored, so it can never drift out of sync with its own children.
RENAME TABLE `evaluation_criteria` TO `categories`;
ALTER TABLE `categories` DROP COLUMN `maxScore`;

-- Criterion (was EvaluationCriterionQuestion): gains real scoring fields
-- (maxScore, isActive - already backfilled) and is renamed to reflect that
-- panel scores now attach here, not at the old category level.
ALTER TABLE `evaluation_criterion_questions` DROP FOREIGN KEY `evaluation_criterion_questions_criterionId_fkey`;
ALTER TABLE `evaluation_criterion_questions` DROP INDEX `evaluation_criterion_questions_criterionId_idx`;
RENAME TABLE `evaluation_criterion_questions` TO `criteria`;
ALTER TABLE `criteria` CHANGE COLUMN `criterionId` `categoryId` VARCHAR(191) NOT NULL;
ALTER TABLE `criteria` CHANGE COLUMN `text` `name` TEXT NOT NULL;
ALTER TABLE `criteria` ADD INDEX `criteria_categoryId_idx` (`categoryId`);
ALTER TABLE `criteria` ADD CONSTRAINT `criteria_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- PanelScore.criterionId now points at the leaf `criteria` table instead of
-- the old top-level `evaluation_criteria` (categories) table. Its FK was
-- already dropped by the pre-migration script (so panel_scores.criterionId
-- could be repointed to a criteria.id without violating the old
-- constraint); this re-adds it against the new target, restricted (not
-- cascading) so a scored criterion can't be deleted out from under a
-- historical score - only deactivated (see CategoriesService).
ALTER TABLE `panel_scores` ADD CONSTRAINT `panel_scores_criterionId_fkey` FOREIGN KEY (`criterionId`) REFERENCES `criteria`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
