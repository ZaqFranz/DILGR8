-- AlterTable
ALTER TABLE `application_compliance_items` ADD COLUMN `submissionType` ENUM('SOFTCOPY', 'HARDCOPY') NOT NULL DEFAULT 'SOFTCOPY';
