-- Adds ApplicantGroup/ApplicantGroupMember for Group Dynamics Evaluation
-- (admin request: "Admin can Group applicants ... for Group dynamics
-- Evaluation"). Purely additive - two new tables, no changes to existing
-- ones - so unlike the rename/data-reshaping migrations elsewhere in this
-- folder there's no data-preservation concern. Written by hand (rather than
-- `prisma migrate dev`) because the shadow database used to diff a new
-- migration replays every prior migration from scratch, and the hand-written
-- 20260819123048_rename_criteria_to_categories migration in this same folder
-- isn't idempotent on a fresh empty database (it depends on FK/data state
-- that migrate dev's real run already resolved) - it fails with a duplicate
-- key error under shadow-db replay even though the real database is fine.
-- This file matches exactly what `prisma migrate dev` would have generated
-- for the schema.prisma diff.
CREATE TABLE `applicant_groups` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `applicant_group_members` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `applicant_group_members_applicationId_idx`(`applicationId`),
    UNIQUE INDEX `applicant_group_members_groupId_applicationId_key`(`groupId`, `applicationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `applicant_group_members` ADD CONSTRAINT `applicant_group_members_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `applicant_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applicant_group_members` ADD CONSTRAINT `applicant_group_members_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
