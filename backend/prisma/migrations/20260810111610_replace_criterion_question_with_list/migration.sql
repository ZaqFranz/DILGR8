-- CreateTable
CREATE TABLE `evaluation_criterion_questions` (
    `id` VARCHAR(191) NOT NULL,
    `criterionId` VARCHAR(191) NOT NULL,
    `text` TEXT NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `evaluation_criterion_questions_criterionId_idx`(`criterionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `evaluation_criterion_questions` ADD CONSTRAINT `evaluation_criterion_questions_criterionId_fkey` FOREIGN KEY (`criterionId`) REFERENCES `evaluation_criteria`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry any existing single `question` text over as each criterion's first
-- question row before the column is dropped, so switching from one
-- free-text question to a list doesn't silently lose existing data.
INSERT INTO `evaluation_criterion_questions` (`id`, `criterionId`, `text`, `sortOrder`)
SELECT UUID(), `id`, `question`, 0
FROM `evaluation_criteria`
WHERE `question` IS NOT NULL AND `question` != '';

-- AlterTable
ALTER TABLE `evaluation_criteria` DROP COLUMN `question`;
