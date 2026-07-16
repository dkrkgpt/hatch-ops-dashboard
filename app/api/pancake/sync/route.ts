import { configuredPages, database, fetchConversations, normalizeConversation } from "../../../../lib/pancake";

export async function POST() {
  const db = database();
  const pages = configuredPages();
  const results = [];

  for (const page of pages) {
    const startedAt = new Date().toISOString();
    let read = 0;
    let updated = 0;
    try {
      const conversations = await fetchConversations(page);
      read = conversations.length;
      const statements = conversations.map((record) => normalizeConversation(page.pageId, record)).filter((lead) => lead.conversationId).map((lead) => db.prepare(`
        INSERT INTO leads (pancake_page_id, conversation_id, customer_id, customer_name, channel, stage, product_tags, location_tags, assigned_agent_id, first_inbound_at, last_interaction_at, sold_at, raw_tags, has_conflict, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(pancake_page_id, conversation_id) DO UPDATE SET
          customer_id=excluded.customer_id, customer_name=excluded.customer_name, channel=excluded.channel,
          stage=excluded.stage, product_tags=excluded.product_tags, location_tags=excluded.location_tags,
          assigned_agent_id=excluded.assigned_agent_id, first_inbound_at=COALESCE(leads.first_inbound_at, excluded.first_inbound_at),
          last_interaction_at=excluded.last_interaction_at, sold_at=excluded.sold_at, raw_tags=excluded.raw_tags,
          has_conflict=excluded.has_conflict, updated_at=CURRENT_TIMESTAMP
      `).bind(lead.pageId, lead.conversationId, lead.customerId, lead.customerName, lead.channel, lead.stage, JSON.stringify(lead.products), JSON.stringify(lead.locations), lead.assignedAgentId, lead.firstInboundAt, lead.lastInteractionAt, lead.soldAt, JSON.stringify(lead.rawTags), lead.hasConflict ? 1 : 0));
      if (statements.length) await db.batch(statements);
      updated = statements.length;
      await db.batch([
        db.prepare("INSERT INTO pancake_pages (id, name, enabled, last_synced_at) VALUES (?, ?, 1, ?) ON CONFLICT(id) DO UPDATE SET last_synced_at=excluded.last_synced_at").bind(page.pageId, `Page ${page.number}`, new Date().toISOString()),
        db.prepare("INSERT INTO sync_runs (page_id, started_at, finished_at, status, conversations_read, leads_updated) VALUES (?, ?, ?, 'success', ?, ?)").bind(page.pageId, startedAt, new Date().toISOString(), read, updated),
      ]);
      results.push({ number: page.number, ok: true, read, updated });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      await db.prepare("INSERT INTO sync_runs (page_id, started_at, finished_at, status, conversations_read, leads_updated, error_message) VALUES (?, ?, ?, 'failed', ?, ?, ?)").bind(page.pageId, startedAt, new Date().toISOString(), read, updated, message).run();
      results.push({ number: page.number, ok: false, read, updated, error: message });
    }
  }

  const connected = results.filter((result) => result.ok).length;
  return Response.json({ ok: connected === pages.length && pages.length === 8, connected, total: 8, results });
}
