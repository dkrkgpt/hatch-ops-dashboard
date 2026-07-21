import { fetchConversations, fetchTags, fetchUsers, normalizeConversation, type PancakePage } from "./pancake";
import { pageName } from "./page-names";

export async function runPancakeSync(db: D1Database, pages: PancakePage[], source: "manual" | "scheduled" = "manual") {
  const lock = await acquireLock(db, source);
  if (!lock) return { ok: false, busy: true, connected: 0, total: pages.length, results: [] };
  const results: Array<{ number: number; ok: boolean; read: number; updated: number; error?: string }> = [];
  try {
    for (const page of pages) {
      const startedAt = new Date().toISOString();
      let read = 0;
      let updated = 0;
      try {
        const [conversations, tagLookup, userLookup] = await Promise.all([fetchConversations(page), fetchTags(page), fetchUsers(page)]);
        read = conversations.length;
        const statements = conversations.map((record) => normalizeConversation(page.pageId, record, tagLookup, userLookup)).filter((lead) => lead.conversationId).map((lead) => db.prepare(`
          INSERT INTO leads (pancake_page_id, conversation_id, customer_id, customer_name, source, platform, external_account_id, external_record_id, source_type, channel, stage, product_tags, location_tags, assigned_agent_id, assigned_agent_name, first_inbound_at, last_interaction_at, sold_at, raw_tags, has_conflict, updated_at)
          VALUES (?, ?, ?, ?, 'pancake', 'pancake', ?, ?, 'message', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(pancake_page_id, conversation_id) DO UPDATE SET
            customer_id=excluded.customer_id, customer_name=excluded.customer_name, source='pancake', platform='pancake',
            external_account_id=excluded.external_account_id, external_record_id=excluded.external_record_id, source_type='message',
            channel=excluded.channel, stage=excluded.stage,
            product_tags=excluded.product_tags, location_tags=excluded.location_tags, assigned_agent_id=excluded.assigned_agent_id,
            assigned_agent_name=COALESCE(excluded.assigned_agent_name, leads.assigned_agent_name), first_inbound_at=COALESCE(leads.first_inbound_at, excluded.first_inbound_at),
            last_interaction_at=excluded.last_interaction_at, sold_at=excluded.sold_at, raw_tags=excluded.raw_tags,
            has_conflict=excluded.has_conflict, updated_at=CURRENT_TIMESTAMP
        `).bind(lead.pageId, lead.conversationId, lead.customerId, lead.customerName, lead.pageId, lead.conversationId, lead.channel, lead.stage, JSON.stringify(lead.products), JSON.stringify(lead.locations), lead.assignedAgentId, lead.assignedAgentName, lead.firstInboundAt, lead.lastInteractionAt, lead.soldAt, JSON.stringify(lead.rawTags), lead.hasConflict ? 1 : 0));
        if (statements.length) await db.batch(statements);
        updated = statements.length;
        const finishedAt = new Date().toISOString();
        await db.batch([
          db.prepare("INSERT INTO pancake_pages (id, name, enabled, last_synced_at) VALUES (?, ?, 1, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, last_synced_at=excluded.last_synced_at").bind(page.pageId, pageName(page.pageId), finishedAt),
          db.prepare("INSERT INTO platform_accounts (platform, external_account_id, name, enabled, last_synced_at) VALUES ('pancake', ?, ?, 1, ?) ON CONFLICT(platform, external_account_id) DO UPDATE SET name=excluded.name, last_synced_at=excluded.last_synced_at").bind(page.pageId, pageName(page.pageId), finishedAt),
          db.prepare("INSERT INTO sync_runs (page_id, started_at, finished_at, status, conversations_read, leads_updated) VALUES (?, ?, ?, 'success', ?, ?)").bind(page.pageId, startedAt, finishedAt, read, updated),
        ]);
        results.push({ number: page.number, ok: true, read, updated });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Sync failed";
        await db.prepare("INSERT INTO sync_runs (page_id, started_at, finished_at, status, conversations_read, leads_updated, error_message) VALUES (?, ?, ?, 'failed', ?, ?, ?)").bind(page.pageId, startedAt, new Date().toISOString(), read, updated, message).run();
        results.push({ number: page.number, ok: false, read, updated, error: message });
      }
    }
  } finally {
    await db.prepare("DELETE FROM sync_lock WHERE id=1").run();
  }
  const connected = results.filter((result) => result.ok).length;
  return { ok: connected === pages.length && pages.length === 8, busy: false, connected, total: pages.length, source, results };
}

async function acquireLock(db: D1Database, source: string) {
  const now = new Date();
  const expires = new Date(now.getTime() + 10 * 60_000).toISOString();
  const result = await db.prepare(`INSERT INTO sync_lock (id, acquired_at, expires_at, source) VALUES (1, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET acquired_at=excluded.acquired_at, expires_at=excluded.expires_at, source=excluded.source
    WHERE sync_lock.expires_at < excluded.acquired_at`).bind(now.toISOString(), expires, source).run();
  return Number(result.meta.changes ?? 0) > 0;
}
