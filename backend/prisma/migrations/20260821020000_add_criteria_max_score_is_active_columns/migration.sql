-- The 20260819123048_rename_criteria_to_categories migration's own comment
-- admits `criteria.maxScore`/`criteria.isActive` were added via a one-off
-- pre-migration script run directly against the one database this was
-- originally authored/applied on - that script was never itself committed
-- as a migration file. Any database that never happened to have that
-- manual step run against it (a genuinely fresh deploy - discovered on an
-- AWS EC2 environment, where `_prisma_migrations` reported "up to date"
-- while `POST /api/categories` 500'd with "column `maxScore` does not
-- exist") is missing these two columns entirely, with no earlier migration
-- ever having added them.
--
-- IF NOT EXISTS makes this safe to apply everywhere, including databases
-- (local dev, and presumably the original AWS Sydney instance) that
-- already have both columns from that undocumented manual step - there,
-- this migration is a verified no-op.
ALTER TABLE `criteria` ADD COLUMN IF NOT EXISTS `maxScore` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `criteria` ADD COLUMN IF NOT EXISTS `isActive` BOOLEAN NOT NULL DEFAULT true;
