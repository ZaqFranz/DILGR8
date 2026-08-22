-- AlterTable
ALTER TABLE `historical_hiring_records` DROP COLUMN `awardCount`,
    DROP COLUMN `hasEligibility`,
    DROP COLUMN `hirePercentage`,
    DROP COLUMN `ldTotalHours`,
    ADD COLUMN `course` VARCHAR(191) NOT NULL,
    ADD COLUMN `eligibilityType` ENUM('RA1080', 'CSC_PROFESSIONAL', 'CSC_SUBPROFESSIONAL', 'BARANGAY', 'NONE') NOT NULL,
    ADD COLUMN `previousJobTitle` VARCHAR(191) NOT NULL,
    ADD COLUMN `wasHired` BOOLEAN NOT NULL,
    ADD COLUMN `year` INTEGER NOT NULL;

-- CreateTable
CREATE TABLE `historical_hiring_awards` (
    `id` VARCHAR(191) NOT NULL,
    `historicalHiringRecordId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `historical_hiring_awards_historicalHiringRecordId_idx`(`historicalHiringRecordId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `historical_hiring_ld_entries` (
    `id` VARCHAR(191) NOT NULL,
    `historicalHiringRecordId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `hours` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `historical_hiring_ld_entries_historicalHiringRecordId_idx`(`historicalHiringRecordId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `historical_hiring_awards` ADD CONSTRAINT `historical_hiring_awards_historicalHiringRecordId_fkey` FOREIGN KEY (`historicalHiringRecordId`) REFERENCES `historical_hiring_records`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historical_hiring_ld_entries` ADD CONSTRAINT `historical_hiring_ld_entries_historicalHiringRecordId_fkey` FOREIGN KEY (`historicalHiringRecordId`) REFERENCES `historical_hiring_records`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
