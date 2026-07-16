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

export const leads = sqliteTable("leads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pancakePageId: text("pancake_page_id").notNull(),
  conversationId: text("conversation_id").notNull(),
  customerId: text("customer_id"),
  customerName: text("customer_name"),
  source: text("source").notNull().default("pancake"),
  channel: text("channel"),
  country: text("country"),
  stage: text("stage").notNull().default("unclassified"),
  productTags: text("product_tags").notNull().default("[]"),
  locationTags: text("location_tags").notNull().default("[]"),
  followUpStatus: text("follow_up_status"),
  assignedAgentId: text("assigned_agent_id"),
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

