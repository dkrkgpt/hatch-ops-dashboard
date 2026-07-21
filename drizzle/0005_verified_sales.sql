CREATE TABLE IF NOT EXISTS `historical_sold_baseline` (
  `lead_id` INTEGER PRIMARY KEY NOT NULL,
  `captured_at` TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS `verified_sales` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `lead_id` INTEGER NOT NULL,
  `sold_at` TEXT NOT NULL,
  `agent_id` TEXT,
  `agent_name` TEXT,
  `platform` TEXT NOT NULL,
  `external_account_id` TEXT,
  `pancake_page_id` TEXT,
  `product_tags` TEXT DEFAULT '[]' NOT NULL,
  `location_tags` TEXT DEFAULT '[]' NOT NULL,
  `detection_method` TEXT DEFAULT 'tag_transition' NOT NULL,
  `created_at` TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `verified_sale_lead_unique` ON `verified_sales` (`lead_id`);
CREATE INDEX IF NOT EXISTS `verified_sale_date_idx` ON `verified_sales` (`sold_at`);
CREATE INDEX IF NOT EXISTS `verified_sale_agent_idx` ON `verified_sales` (`agent_id`);

INSERT OR IGNORE INTO `historical_sold_baseline` (`lead_id`)
SELECT `id` FROM `leads` WHERE `stage` = 'sold';

CREATE TRIGGER IF NOT EXISTS `capture_sold_update`
AFTER UPDATE OF `stage` ON `leads`
WHEN OLD.`stage` IS NOT 'sold' AND NEW.`stage` = 'sold'
BEGIN
  INSERT OR IGNORE INTO `historical_sold_baseline` (`lead_id`)
  SELECT NEW.`id` WHERE CURRENT_TIMESTAMP < '2026-07-21 16:00:00';

  INSERT OR IGNORE INTO `verified_sales` (`lead_id`,`sold_at`,`agent_id`,`agent_name`,`platform`,`external_account_id`,`pancake_page_id`,`product_tags`,`location_tags`)
  SELECT NEW.`id`, CURRENT_TIMESTAMP, NEW.`assigned_agent_id`, NEW.`assigned_agent_name`, NEW.`platform`,
    NEW.`external_account_id`, NEW.`pancake_page_id`, NEW.`product_tags`, NEW.`location_tags`
  WHERE CURRENT_TIMESTAMP >= '2026-07-21 16:00:00'
    AND NOT EXISTS (SELECT 1 FROM `historical_sold_baseline` WHERE `lead_id` = NEW.`id`);
END;

CREATE TRIGGER IF NOT EXISTS `capture_sold_insert`
AFTER INSERT ON `leads`
WHEN NEW.`stage` = 'sold'
BEGIN
  INSERT OR IGNORE INTO `historical_sold_baseline` (`lead_id`)
  SELECT NEW.`id` WHERE CURRENT_TIMESTAMP < '2026-07-21 16:00:00';

  INSERT OR IGNORE INTO `verified_sales` (`lead_id`,`sold_at`,`agent_id`,`agent_name`,`platform`,`external_account_id`,`pancake_page_id`,`product_tags`,`location_tags`)
  SELECT NEW.`id`, CURRENT_TIMESTAMP, NEW.`assigned_agent_id`, NEW.`assigned_agent_name`, NEW.`platform`,
    NEW.`external_account_id`, NEW.`pancake_page_id`, NEW.`product_tags`, NEW.`location_tags`
  WHERE CURRENT_TIMESTAMP >= '2026-07-21 16:00:00'
    AND NOT EXISTS (SELECT 1 FROM `historical_sold_baseline` WHERE `lead_id` = NEW.`id`);
END;
