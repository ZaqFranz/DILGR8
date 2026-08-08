-- AlterTable
ALTER TABLE `applications` ADD COLUMN `interviewAttire` TEXT NULL,
    ADD COLUMN `interviewNotes` TEXT NULL,
    ADD COLUMN `interviewScheduledAt` DATETIME(3) NULL,
    ADD COLUMN `interviewVenue` TEXT NULL;
