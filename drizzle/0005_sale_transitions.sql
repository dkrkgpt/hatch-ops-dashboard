ALTER TABLE `leads` ADD `legacy_sold_at` TEXT;

UPDATE `leads` SET `legacy_sold_at` = `sold_at`, `sold_at` = NULL WHERE `sold_at` IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS `lead_stage_transition_event`
AFTER UPDATE OF `stage` ON `leads`
WHEN OLD.`stage` IS NOT NEW.`stage`
BEGIN
  INSERT INTO `stage_events` (`lead_id`,`from_stage`,`to_stage`,`changed_at`,`source_tags`)
  VALUES (NEW.`id`, OLD.`stage`, NEW.`stage`, CURRENT_TIMESTAMP, NEW.`raw_tags`);
END;

CREATE TRIGGER IF NOT EXISTS `new_sold_lead_event`
AFTER INSERT ON `leads`
WHEN NEW.`stage` = 'sold'
BEGIN
  INSERT INTO `stage_events` (`lead_id`,`from_stage`,`to_stage`,`changed_at`,`source_tags`)
  VALUES (NEW.`id`, NULL, 'sold', CURRENT_TIMESTAMP, NEW.`raw_tags`);
  UPDATE `leads` SET `sold_at` = CURRENT_TIMESTAMP, `stage_changed_at` = CURRENT_TIMESTAMP WHERE `id` = NEW.`id`;
END;
