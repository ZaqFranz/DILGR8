-- CreateTable
CREATE TABLE `historical_hiring_records` (
    `id` VARCHAR(191) NOT NULL,
    `educationLevel` ENUM('ELEMENTARY', 'HIGH_SCHOOL', 'VOCATIONAL', 'COLLEGE_LEVEL', 'BACHELORS', 'MASTERS_LEVEL', 'MASTERS', 'DOCTORATE_LEVEL', 'DOCTORATE') NOT NULL,
    `yearsOfExperience` INTEGER NOT NULL,
    `hasEligibility` BOOLEAN NOT NULL,
    `awardCount` INTEGER NOT NULL,
    `ldTotalHours` INTEGER NOT NULL,
    `hirePercentage` DOUBLE NOT NULL,
    `sourceNote` VARCHAR(191) NULL,
    `enteredByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `historical_hiring_records` ADD CONSTRAINT `historical_hiring_records_enteredByUserId_fkey` FOREIGN KEY (`enteredByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
