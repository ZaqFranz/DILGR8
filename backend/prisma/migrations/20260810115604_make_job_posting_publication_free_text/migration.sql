-- AlterTable
ALTER TABLE `job_postings` MODIFY `publication` VARCHAR(191) NOT NULL DEFAULT 'ROS-1';

-- Normalize existing enum-era values ("ROS_1"/"ROS_2") to the free-text
-- display form ("ROS-1"/"ROS-2") admins will now type directly, so existing
-- postings don't suddenly show an underscore-cased value after this change.
UPDATE `job_postings` SET `publication` = 'ROS-1' WHERE `publication` = 'ROS_1';
UPDATE `job_postings` SET `publication` = 'ROS-2' WHERE `publication` = 'ROS_2';
