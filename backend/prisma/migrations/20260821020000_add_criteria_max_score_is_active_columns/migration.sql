-- The 20260819123048_rename_criteria_to_categories migration's own comment
-- admits `criteria.maxScore`/`criteria.isActive` were added via a one-off
-- pre-migration script run directly against the one database this was
-- originally authored/applied on - that script was never itself committed
-- as a migration file. Any database that never happened to have that
-- manual step run against it (a genuinely fresh deploy - discovered on an
-- AWS EC2 environment, where `_prisma_migrations` reported "up to date"
-- while `POST /api/categories` 500'd with "column `maxScore` does not
-- exist") is missing these two columns entirely, with no earlier migration
-- ever having added them.
--
-- `ADD COLUMN IF NOT EXISTS` (MySQL 8.0.29+) isn't supported by every
-- MySQL version this project might run against - confirmed live: it's a
-- syntax error (1064) on the AWS EC2 instance's MySQL server. Using the
-- INFORMATION_SCHEMA + PREPARE/EXECUTE pattern instead, which works on any
-- MySQL/MariaDB version - portable rather than assuming a MySQL version
-- floor, and still a verified no-op wherever both columns already exist
-- (local dev, and presumably the original AWS Sydney instance).
SET @maxScoreExists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'criteria' AND COLUMN_NAME = 'maxScore'
);
SET @addMaxScore = IF(
  @maxScoreExists = 0,
  'ALTER TABLE `criteria` ADD COLUMN `maxScore` INTEGER NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @addMaxScore;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @isActiveExists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'criteria' AND COLUMN_NAME = 'isActive'
);
SET @addIsActive = IF(
  @isActiveExists = 0,
  'ALTER TABLE `criteria` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true',
  'SELECT 1'
);
PREPARE stmt FROM @addIsActive;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
