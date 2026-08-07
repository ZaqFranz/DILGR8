-- AlterTable
ALTER TABLE `applications` ADD COLUMN `evaluatedAt` DATETIME(3) NULL,
    ADD COLUMN `evaluatedByUserId` VARCHAR(191) NULL,
    ADD COLUMN `evaluationRemarks` TEXT NULL,
    ADD COLUMN `evaluationScore` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `applications` ADD CONSTRAINT `applications_evaluatedByUserId_fkey` FOREIGN KEY (`evaluatedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
