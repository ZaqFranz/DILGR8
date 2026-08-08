-- DropForeignKey
ALTER TABLE `applications` DROP FOREIGN KEY `applications_evaluatedByUserId_fkey`;

-- AlterTable
ALTER TABLE `applications` DROP COLUMN `evaluatedAt`,
    DROP COLUMN `evaluatedByUserId`,
    DROP COLUMN `evaluationRemarks`,
    DROP COLUMN `evaluationScore`,
    ADD COLUMN `examinationScore` INTEGER NULL,
    ADD COLUMN `examinationScoredAt` DATETIME(3) NULL,
    ADD COLUMN `siftedAt` DATETIME(3) NULL,
    ADD COLUMN `siftedByUserId` VARCHAR(191) NULL,
    ADD COLUMN `siftingRemarks` TEXT NULL;

-- AddForeignKey
ALTER TABLE `applications` ADD CONSTRAINT `applications_siftedByUserId_fkey` FOREIGN KEY (`siftedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

