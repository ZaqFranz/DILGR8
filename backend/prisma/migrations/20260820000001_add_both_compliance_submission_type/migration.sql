-- AlterTable
ALTER TABLE `application_compliance_items` MODIFY COLUMN `submissionType` ENUM('SOFTCOPY', 'HARDCOPY', 'BOTH') NOT NULL DEFAULT 'SOFTCOPY';
