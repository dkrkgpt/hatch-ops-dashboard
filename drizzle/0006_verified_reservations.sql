CREATE TABLE IF NOT EXISTS `historical_reservation_baseline` (
  `lead_id` INTEGER PRIMARY KEY NOT NULL,
  `captured_at` TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS `verified_reservations` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `lead_id` INTEGER NOT NULL,
  `reserved_at` TEXT NOT NULL,
  `agent_id` TEXT,
  `agent_name` TEXT,
  `platform` TEXT NOT NULL,
  `external_account_id` TEXT,
  `pancake_page_id` TEXT,
  `product_tags` TEXT DEFAULT '[]' NOT NULL,
  `location_tags` TEXT DEFAULT '[]' NOT NULL,
  `created_at` TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `verified_reservation_lead_unique` ON `verified_reservations` (`lead_id`);
CREATE INDEX IF NOT EXISTS `verified_reservation_date_idx` ON `verified_reservations` (`reserved_at`);

INSERT OR IGNORE INTO `historical_reservation_baseline` (`lead_id`)
SELECT `id` FROM `leads` WHERE instr(`raw_tags`, '"RESERVATION"') > 0;

CREATE TRIGGER IF NOT EXISTS `capture_reservation_update`
AFTER UPDATE OF `raw_tags` ON `leads`
WHEN instr(OLD.`raw_tags`, '"RESERVATION"') = 0 AND instr(NEW.`raw_tags`, '"RESERVATION"') > 0
BEGIN
  INSERT OR IGNORE INTO `verified_reservations` (`lead_id`,`reserved_at`,`agent_id`,`agent_name`,`platform`,`external_account_id`,`pancake_page_id`,`product_tags`,`location_tags`)
  SELECT NEW.`id`, CURRENT_TIMESTAMP, NEW.`assigned_agent_id`, NEW.`assigned_agent_name`, NEW.`platform`, NEW.`external_account_id`, NEW.`pancake_page_id`, NEW.`product_tags`, NEW.`location_tags`
  WHERE NOT EXISTS (SELECT 1 FROM `historical_reservation_baseline` WHERE `lead_id` = NEW.`id`);
END;

CREATE TRIGGER IF NOT EXISTS `capture_reservation_insert`
AFTER INSERT ON `leads`
WHEN instr(NEW.`raw_tags`, '"RESERVATION"') > 0
BEGIN
  INSERT OR IGNORE INTO `verified_reservations` (`lead_id`,`reserved_at`,`agent_id`,`agent_name`,`platform`,`external_account_id`,`pancake_page_id`,`product_tags`,`location_tags`)
  SELECT NEW.`id`, CURRENT_TIMESTAMP, NEW.`assigned_agent_id`, NEW.`assigned_agent_name`, NEW.`platform`, NEW.`external_account_id`, NEW.`pancake_page_id`, NEW.`product_tags`, NEW.`location_tags`
  WHERE NOT EXISTS (SELECT 1 FROM `historical_reservation_baseline` WHERE `lead_id` = NEW.`id`);
END;
