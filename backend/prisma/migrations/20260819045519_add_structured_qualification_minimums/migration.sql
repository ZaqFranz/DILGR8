/*
  Warnings:

  - Added the required column `educationLevel` to the `applicants` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `applicants` ADD COLUMN `educationLevel` ENUM('ELEMENTARY', 'HIGH_SCHOOL', 'VOCATIONAL', 'COLLEGE_LEVEL', 'BACHELORS', 'MASTERS_LEVEL', 'MASTERS', 'DOCTORATE_LEVEL', 'DOCTORATE') NOT NULL,
    ADD COLUMN `yearsOfExperience` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `job_postings` ADD COLUMN `minEducationLevel` ENUM('ELEMENTARY', 'HIGH_SCHOOL', 'VOCATIONAL', 'COLLEGE_LEVEL', 'BACHELORS', 'MASTERS_LEVEL', 'MASTERS', 'DOCTORATE_LEVEL', 'DOCTORATE') NULL,
    ADD COLUMN `minTrainingHours` INTEGER NULL,
    ADD COLUMN `minYearsExperience` INTEGER NULL;
