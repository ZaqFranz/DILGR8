-- AlterTable: add the four new required columns as nullable, backfill
-- existing rows with placeholders, then enforce NOT NULL (MySQL columns
-- without a DEFAULT can't go straight to NOT NULL against existing rows).
-- Also drops positionLevel (ENTRY/PROMOTIONAL) - nothing in the codebase
-- branches on it anymore (the PROMOTIONAL-posting document gate was removed
-- in an earlier migration), replaced by these fields plus the existing
-- qualification* columns to match the official DILG job posting document
-- format (Position Title / No. of Vacant Position(s) / Plantilla Number(s)
-- / Salary Grade / Monthly Salary / Place of Assignment / Position Next in
-- Rank / Qualification Standards).
ALTER TABLE `job_postings`
  ADD COLUMN `numberOfVacantPositions` VARCHAR(191) NULL,
  ADD COLUMN `plantillaNumbers` TEXT NULL,
  ADD COLUMN `salaryGrade` VARCHAR(191) NULL,
  ADD COLUMN `positionNextInRank` TEXT NULL;

UPDATE `job_postings`
SET `numberOfVacantPositions` = 'One (1)',
    `plantillaNumbers` = 'Not yet specified',
    `salaryGrade` = 'Not yet specified',
    `positionNextInRank` = 'None required'
WHERE `numberOfVacantPositions` IS NULL;

ALTER TABLE `job_postings`
  MODIFY COLUMN `numberOfVacantPositions` VARCHAR(191) NOT NULL,
  MODIFY COLUMN `plantillaNumbers` TEXT NOT NULL,
  MODIFY COLUMN `salaryGrade` VARCHAR(191) NOT NULL,
  MODIFY COLUMN `positionNextInRank` TEXT NOT NULL;

ALTER TABLE `job_postings` DROP COLUMN `positionLevel`;
