-- AlterTable
ALTER TABLE `applications` ADD COLUMN `complianceCompletedAt` DATETIME(3) NULL,
    ADD COLUMN `complianceRequestedAt` DATETIME(3) NULL,
    ADD COLUMN `hiredAt` DATETIME(3) NULL,
    ADD COLUMN `oathTakingNotes` TEXT NULL,
    ADD COLUMN `oathTakingScheduledAt` DATETIME(3) NULL,
    ADD COLUMN `oathTakingVenue` TEXT NULL,
    MODIFY `status` ENUM('SUBMITTED', 'UNDER_SIFTING', 'FOR_INTERVIEW', 'QUALIFIED', 'NOT_QUALIFIED', 'FOR_COMPLIANCE', 'FOR_OATH_TAKING', 'HIRED', 'WITHDRAWN') NOT NULL DEFAULT 'SUBMITTED';

-- AlterTable
ALTER TABLE `documents` ADD COLUMN `complianceItemId` VARCHAR(191) NULL,
    MODIFY `type` ENUM('APPLICATION_LETTER', 'PDS', 'PDS_EXCEL', 'IPCR', 'ELIGIBILITY_PROOF', 'LD_PROOF', 'TRANSCRIPT_OF_RECORDS', 'DIPLOMA', 'PQE_NOTICE', 'DESIGNATION_ORDER', 'AWARD_PROOF', 'COMPLIANCE_PROOF', 'OTHER') NOT NULL;

-- CreateTable
CREATE TABLE `compliance_requirements` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `application_compliance_items` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `requirementId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `remarks` TEXT NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewedByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `application_compliance_items_requirementId_idx`(`requirementId`),
    UNIQUE INDEX `application_compliance_items_applicationId_requirementId_key`(`applicationId`, `requirementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `documents_complianceItemId_idx` ON `documents`(`complianceItemId`);

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_complianceItemId_fkey` FOREIGN KEY (`complianceItemId`) REFERENCES `application_compliance_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_compliance_items` ADD CONSTRAINT `application_compliance_items_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_compliance_items` ADD CONSTRAINT `application_compliance_items_requirementId_fkey` FOREIGN KEY (`requirementId`) REFERENCES `compliance_requirements`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `application_compliance_items` ADD CONSTRAINT `application_compliance_items_reviewedByUserId_fkey` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
