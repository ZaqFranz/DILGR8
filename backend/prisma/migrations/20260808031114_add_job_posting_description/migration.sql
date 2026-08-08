-- AlterTable: add as nullable, backfill existing rows, then enforce NOT NULL
-- (MySQL TEXT columns can't carry a DEFAULT, so a single ADD COLUMN ... NOT NULL
-- would fail against the 3 existing seeded job postings.)
ALTER TABLE `job_postings` ADD COLUMN `description` TEXT NULL;
UPDATE `job_postings` SET `description` = 'Description not yet provided for this posting.' WHERE `description` IS NULL;
ALTER TABLE `job_postings` MODIFY COLUMN `description` TEXT NOT NULL;
