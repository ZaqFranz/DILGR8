-- CreateTable
CREATE TABLE `job_posting_required_eligibilities` (
    `id` VARCHAR(191) NOT NULL,
    `jobPostingId` VARCHAR(191) NOT NULL,
    `eligibilityType` ENUM('RA1080', 'CSC_PROFESSIONAL', 'CSC_SUBPROFESSIONAL', 'BARANGAY', 'NONE') NOT NULL,

    UNIQUE INDEX `job_posting_required_eligibilities_jobPostingId_eligibilityT_key`(`jobPostingId`, `eligibilityType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `job_posting_required_eligibilities` ADD CONSTRAINT `job_posting_required_eligibilities_jobPostingId_fkey` FOREIGN KEY (`jobPostingId`) REFERENCES `job_postings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
