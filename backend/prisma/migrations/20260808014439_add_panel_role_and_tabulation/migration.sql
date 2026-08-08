-- AlterTable
ALTER TABLE `applications` MODIFY `status` ENUM('SUBMITTED', 'UNDER_SIFTING', 'FOR_INTERVIEW', 'QUALIFIED', 'NOT_QUALIFIED', 'WITHDRAWN') NOT NULL DEFAULT 'SUBMITTED';

-- AlterTable
ALTER TABLE `users` MODIFY `role` ENUM('APPLICANT', 'ADMIN', 'PANEL') NOT NULL DEFAULT 'APPLICANT';

-- CreateTable
CREATE TABLE `evaluation_criteria` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `maxScore` INTEGER NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `panel_assignments` (
    `id` VARCHAR(191) NOT NULL,
    `jobPostingId` VARCHAR(191) NOT NULL,
    `panelUserId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `panel_assignments_jobPostingId_panelUserId_key`(`jobPostingId`, `panelUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `panel_evaluations` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `panelUserId` VARCHAR(191) NOT NULL,
    `remarks` TEXT NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `panel_evaluations_applicationId_panelUserId_key`(`applicationId`, `panelUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `panel_scores` (
    `id` VARCHAR(191) NOT NULL,
    `panelEvaluationId` VARCHAR(191) NOT NULL,
    `criterionId` VARCHAR(191) NOT NULL,
    `score` INTEGER NOT NULL,

    UNIQUE INDEX `panel_scores_panelEvaluationId_criterionId_key`(`panelEvaluationId`, `criterionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `panel_assignments` ADD CONSTRAINT `panel_assignments_jobPostingId_fkey` FOREIGN KEY (`jobPostingId`) REFERENCES `job_postings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `panel_assignments` ADD CONSTRAINT `panel_assignments_panelUserId_fkey` FOREIGN KEY (`panelUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `panel_evaluations` ADD CONSTRAINT `panel_evaluations_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `panel_evaluations` ADD CONSTRAINT `panel_evaluations_panelUserId_fkey` FOREIGN KEY (`panelUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `panel_scores` ADD CONSTRAINT `panel_scores_panelEvaluationId_fkey` FOREIGN KEY (`panelEvaluationId`) REFERENCES `panel_evaluations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `panel_scores` ADD CONSTRAINT `panel_scores_criterionId_fkey` FOREIGN KEY (`criterionId`) REFERENCES `evaluation_criteria`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
