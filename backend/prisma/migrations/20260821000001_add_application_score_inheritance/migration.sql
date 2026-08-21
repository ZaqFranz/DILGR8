-- AlterTable
ALTER TABLE `applications` ADD COLUMN `scoreSourceApplicationId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `applications_scoreSourceApplicationId_idx` ON `applications`(`scoreSourceApplicationId`);

-- AddForeignKey
ALTER TABLE `applications` ADD CONSTRAINT `applications_scoreSourceApplicationId_fkey` FOREIGN KEY (`scoreSourceApplicationId`) REFERENCES `applications`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
