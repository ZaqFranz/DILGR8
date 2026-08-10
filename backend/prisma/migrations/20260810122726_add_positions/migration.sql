-- AlterTable
ALTER TABLE `job_postings` ADD COLUMN `positionId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `positions` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `positions_title_key`(`title`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `position_panel_members` (
    `id` VARCHAR(191) NOT NULL,
    `positionId` VARCHAR(191) NOT NULL,
    `panelUserId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `position_panel_members_positionId_panelUserId_key`(`positionId`, `panelUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `job_postings_positionId_idx` ON `job_postings`(`positionId`);

-- AddForeignKey
ALTER TABLE `job_postings` ADD CONSTRAINT `job_postings_positionId_fkey` FOREIGN KEY (`positionId`) REFERENCES `positions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `position_panel_members` ADD CONSTRAINT `position_panel_members_positionId_fkey` FOREIGN KEY (`positionId`) REFERENCES `positions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `position_panel_members` ADD CONSTRAINT `position_panel_members_panelUserId_fkey` FOREIGN KEY (`panelUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
