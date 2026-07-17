ALTER TABLE `leads` ADD `assigned_agent_name` text;
--> statement-breakpoint
CREATE TABLE `pancake_backfill_state` (
	`page_id` text PRIMARY KEY NOT NULL,
	`cursor` text,
	`oldest_at` text,
	`cutoff_at` text NOT NULL,
	`conversations_imported` integer DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
