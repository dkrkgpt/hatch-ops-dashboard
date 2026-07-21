import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const pancakePages = sqliteTable("pancake_pages", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  country: text("country"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastSyncedAt: text("last_synced_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const platformAccounts = sqliteTable("platform_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  platform: text("platform").notNull(),
  externalAccountId: text("external_account_id").notNull(),
  name: text("name").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastSyncedAt: text("last_synced_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("platform_account_unique").on(table.platform, table.externalAccountId)]);

export const leads = sqliteTable("leads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pancakePageId: text("pancake_page_id").notNull(),
  conversationId: text("conversation_id").notNull(),
  customerId: text("customer_id"),
  customerName: text("customer_name"),
  source: text("source").notNull().default("pancake"),
  platform: text("platform").notNull().default("pancake"),
  externalAccountId: text("external_account_id"),
  externalRecordId: text("external_record_id"),
  sourceType: text("source_type").notNull().default("message"),
  channel: text("channel"),
  country: text("country"),
  stage: text("stage").notNull().default("unclassified"),
  productTags: text("product_tags").notNull().default("[]"),
  locationTags: text("location_tags").notNull().default("[]"),
  followUpStatus: text("follow_up_status"),
  assignedAgentId: text("assigned_agent_id"),
  assignedAgentName: text("assigned_agent_name"),
  firstInboundAt: text("first_inbound_at"),
  lastInteractionAt: text("last_interaction_at"),
  stageChangedAt: text("stage_changed_at"),
  soldAt: text("sold_at"),
  nextFollowUpAt: text("next_follow_up_at"),
  rawTags: text("raw_tags").notNull().default("[]"),
  hasConflict: integer("has_conflict", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("lead_page_conversation_unique").on(table.pancakePageId, table.conversationId),
  index("lead_stage_idx").on(table.stage),
  index("lead_follow_up_idx").on(table.nextFollowUpAt),
  index("lead_last_interaction_idx").on(table.lastInteractionAt),
  index("lead_page_idx").on(table.pancakePageId),
  index("lead_agent_idx").on(table.assignedAgentId),
  index("lead_sold_at_idx").on(table.soldAt),
  uniqueIndex("lead_platform_record_unique").on(table.platform, table.externalAccountId, table.externalRecordId),
  index("lead_platform_idx").on(table.platform),
  index("lead_platform_account_idx").on(table.platform, table.externalAccountId),
]);

export const stageEvents = sqliteTable("stage_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leadId: integer("lead_id").notNull(),
  fromStage: text("from_stage"),
  toStage: text("to_stage").notNull(),
  changedAt: text("changed_at").notNull(),
  sourceTags: text("source_tags").notNull().default("[]"),
}, (table) => [index("stage_event_lead_idx").on(table.leadId)]);

export const syncRuns = sqliteTable("sync_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pageId: text("page_id").notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  status: text("status").notNull(),
  conversationsRead: integer("conversations_read").notNull().default(0),
  leadsUpdated: integer("leads_updated").notNull().default(0),
  errorMessage: text("error_message"),
});

export const historicalSoldBaseline = sqliteTable("historical_sold_baseline", {
  leadId: integer("lead_id").primaryKey(),
  capturedAt: text("captured_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const verifiedSales = sqliteTable("verified_sales", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leadId: integer("lead_id").notNull(),
  soldAt: text("sold_at").notNull(),
  agentId: text("agent_id"), agentName: text("agent_name"), platform: text("platform").notNull(),
  externalAccountId: text("external_account_id"), pancakePageId: text("pancake_page_id"),
  productTags: text("product_tags").notNull().default("[]"), locationTags: text("location_tags").notNull().default("[]"),
  detectionMethod: text("detection_method").notNull().default("tag_transition"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("verified_sale_lead_unique").on(table.leadId), index("verified_sale_date_idx").on(table.soldAt), index("verified_sale_agent_idx").on(table.agentId)]);

export const pancakeBackfillState = sqliteTable("pancake_backfill_state", {
  pageId: text("page_id").primaryKey(),
  cursor: text("cursor"),
  oldestAt: text("oldest_at"),
  cutoffAt: text("cutoff_at").notNull(),
  conversationsImported: integer("conversations_imported").notNull().default(0),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const syncLock = sqliteTable("sync_lock", {
  id: integer("id").primaryKey(),
  acquiredAt: text("acquired_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  source: text("source").notNull(),
});

