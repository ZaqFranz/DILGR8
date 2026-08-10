-- AlterTable
ALTER TABLE `job_postings` ADD COLUMN `publication` ENUM('ROS_1', 'ROS_2') NOT NULL DEFAULT 'ROS_1';

-- CreateIndex
CREATE INDEX `job_postings_publication_idx` ON `job_postings`(`publication`);
