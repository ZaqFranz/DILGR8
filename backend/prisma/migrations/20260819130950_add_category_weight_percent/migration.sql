-- Adds Category.weightPercent, per client request: "If I clicked Category
-- I should have an input how much percent is this category for the
-- overall evaluation. Example I put 25% in Battery test even I have many
-- criteria max point should still be 25% of the overall evaluation."
--
-- weightPercent is the admin-set, authoritative share of the overall
-- evaluation this category is worth - independent of the raw point total
-- its criteria sum to. A panelist's raw subtotal for the category is
-- normalized against that raw total and scaled to weightPercent before it
-- counts toward the overall score (see PanelEvaluationsService).
--
-- Standard add-nullable -> backfill -> enforce-NOT-NULL sequence (same
-- pattern used by earlier migrations like description/monthlySalary) since
-- MySQL can't add a NOT NULL column with no default to a non-empty table.
-- The one pre-existing category in this environment ("Extemporanious
-- Speaking") is backfilled to 100 - the only sensible default when it's
-- the sole category and no other weight information exists; the admin can
-- adjust it via the normal edit flow afterward.
ALTER TABLE `categories` ADD COLUMN `weightPercent` INTEGER NULL;
UPDATE `categories` SET `weightPercent` = 100 WHERE `weightPercent` IS NULL;
ALTER TABLE `categories` MODIFY COLUMN `weightPercent` INTEGER NOT NULL;
