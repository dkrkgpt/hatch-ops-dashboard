CREATE TABLE IF NOT EXISTS `platform_accounts` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `platform` TEXT NOT NULL,
  `external_account_id` TEXT NOT NULL,
  `name` TEXT NOT NULL,
  `enabled` INTEGER DEFAULT 1 NOT NULL,
  `last_synced_at` TEXT,
  `created_at` TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `platform_account_unique` ON `platform_accounts` (`platform`,`external_account_id`);

ALTER TABLE `leads` ADD `platform` TEXT DEFAULT 'pancake' NOT NULL;
ALTER TABLE `leads` ADD `external_account_id` TEXT;
ALTER TABLE `leads` ADD `external_record_id` TEXT;
ALTER TABLE `leads` ADD `source_type` TEXT DEFAULT 'message' NOT NULL;

UPDATE `leads` SET
  `platform` = COALESCE(NULLIF(`source`, ''), 'pancake'),
  `external_account_id` = COALESCE(`external_account_id`, `pancake_page_id`),
  `external_record_id` = COALESCE(`external_record_id`, `conversation_id`);

INSERT OR IGNORE INTO `platform_accounts` (`platform`,`external_account_id`,`name`,`enabled`,`last_synced_at`)
SELECT 'pancake', `id`, `name`, `enabled`, `last_synced_at` FROM `pancake_pages`;

CREATE UNIQUE INDEX IF NOT EXISTS `lead_platform_record_unique` ON `leads` (`platform`,`external_account_id`,`external_record_id`);
CREATE INDEX IF NOT EXISTS `lead_platform_idx` ON `leads` (`platform`);
CREATE INDEX IF NOT EXISTS `lead_platform_account_idx` ON `leads` (`platform`,`external_account_id`);
