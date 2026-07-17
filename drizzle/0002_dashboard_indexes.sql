CREATE INDEX `lead_last_interaction_idx` ON `leads` (`last_interaction_at`);
--> statement-breakpoint
CREATE INDEX `lead_page_idx` ON `leads` (`pancake_page_id`);
--> statement-breakpoint
CREATE INDEX `lead_agent_idx` ON `leads` (`assigned_agent_id`);
--> statement-breakpoint
CREATE INDEX `lead_sold_at_idx` ON `leads` (`sold_at`);
