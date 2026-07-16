CREATE TABLE `leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pancake_page_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`customer_id` text,
	`customer_name` text,
	`source` text DEFAULT 'pancake' NOT NULL,
	`channel` text,
	`country` text,
	`stage` text DEFAULT 'unclassified' NOT NULL,
	`product_tags` text DEFAULT '[]' NOT NULL,
	`location_tags` text DEFAULT '[]' NOT NULL,
	`follow_up_status` text,
	`assigned_agent_id` text,
	`first_inbound_at` text,
	`last_interaction_at` text,
	`stage_changed_at` text,
	`sold_at` text,
	`next_follow_up_at` text,
	`raw_tags` text DEFAULT '[]' NOT NULL,
	`has_conflict` integer DEFAULT false NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lead_page_conversation_unique` ON `leads` (`pancake_page_id`,`conversation_id`);--> statement-breakpoint
CREATE INDEX `lead_stage_idx` ON `leads` (`stage`);--> statement-breakpoint
CREATE INDEX `lead_follow_up_idx` ON `leads` (`next_follow_up_at`);--> statement-breakpoint
CREATE TABLE `pancake_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`country` text,
	`enabled` integer DEFAULT true NOT NULL,
	`last_synced_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stage_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_id` integer NOT NULL,
	`from_stage` text,
	`to_stage` text NOT NULL,
	`changed_at` text NOT NULL,
	`source_tags` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `stage_event_lead_idx` ON `stage_events` (`lead_id`);--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`page_id` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`status` text NOT NULL,
	`conversations_read` integer DEFAULT 0 NOT NULL,
	`leads_updated` integer DEFAULT 0 NOT NULL,
	`error_message` text
);

