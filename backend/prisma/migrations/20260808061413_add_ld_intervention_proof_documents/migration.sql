-- AlterTable
ALTER TABLE `documents` ADD COLUMN `ldInterventionId` VARCHAR(191) NULL,
    MODIFY `type` ENUM('ELIGIBILITY_PROOF', 'IPCR', 'DESIGNATION_ORDER', 'LD_PROOF', 'OTHER') NOT NULL;

-- CreateIndex
CREATE INDEX `documents_ldInterventionId_idx` ON `documents`(`ldInterventionId`);

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_ldInterventionId_fkey` FOREIGN KEY (`ldInterventionId`) REFERENCES `ld_interventions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
