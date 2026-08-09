-- AlterTable
ALTER TABLE `documents` ADD COLUMN `awardId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `documents_awardId_idx` ON `documents`(`awardId`);

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_awardId_fkey` FOREIGN KEY (`awardId`) REFERENCES `awards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
