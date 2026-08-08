-- AlterTable: add as nullable, backfill existing rows, then enforce NOT NULL
-- (MySQL TEXT columns can't carry a DEFAULT, so a single ADD COLUMN ... NOT NULL
-- would fail against the existing seeded job postings.)
ALTER TABLE `job_postings`
  ADD COLUMN `monthlySalary` VARCHAR(191) NULL,
  ADD COLUMN `placeOfAssignment` TEXT NULL,
  ADD COLUMN `duties` TEXT NULL;

UPDATE `job_postings`
SET `monthlySalary` = 'Not yet specified',
    `placeOfAssignment` = 'Not yet specified',
    `duties` = 'Not yet specified.'
WHERE `monthlySalary` IS NULL;

ALTER TABLE `job_postings`
  MODIFY COLUMN `monthlySalary` VARCHAR(191) NOT NULL,
  MODIFY COLUMN `placeOfAssignment` TEXT NOT NULL,
  MODIFY COLUMN `duties` TEXT NOT NULL;
