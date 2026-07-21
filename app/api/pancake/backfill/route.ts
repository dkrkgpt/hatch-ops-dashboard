import { configuredPages, database, fetchConversations, fetchTags, fetchUsers, normalizeConversation } from "../../../../lib/pancake";

type BackfillState = { cursor?: string | null; cutoff_at?: string; conversations_imported?: number; completed?: number };

function cutoffForMonths(months: number) {
  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  return cutoff.toISOString();
}

export async function GET() {
  const rows = await database().prepare("SELECT page_id, cursor, oldest_at, cutoff_at, conversations_imported, completed, updated_at FROM pancake_backfill_state ORDER BY page_id").all();
  return Response.json({ pages: rows.results });
}

export async function POST(request: Request) {
  const db = database();
  const body = await request.json().catch(() => ({})) as { months?: number; reset?: boolean };
  const months = body.months === 3 ? 3 : 6;
  const requestedCutoff = cutoffForMonths(months);
  if (body.reset) await db.prepare("DELETE FROM pancake_backfill_state").run();

  const results = [];
  for (const page of configuredPages()) {
    const state = await db.prepare("SELECT cursor, cutoff_at, conversations_imported, completed FROM pancake_backfill_state WHERE page_id=?").bind(page.pageId).first<BackfillState>();
    if (state?.completed && !body.reset) {
      results.push({ number: page.number, done: true, imported: 0, totalImported: Number(state.conversations_imported ?? 0) });
      continue;
    }

    const cutoffAt = state?.cutoff_at && !body.reset ? state.cutoff_at : requestedCutoff;
    const cursor = state?.cutoff_at === cutoffAt ? state.cursor ?? undefined : undefined;
    try {
      const [conversations, tagLookup, userLookup] = await Promise.all([fetchConversations(page, cursor), fetchTags(page), fetchUsers(page)]);
      const leads = conversations.map((record) => normalizeConversation(page.pageId, record, tagLookup, userLookup)).filter((lead) => lead.conversationId);
      const inWindow = leads.filter((lead) => {
        const activityAt = lead.lastInteractionAt ?? lead.firstInboundAt;
        return !activityAt || activityAt >= cutoffAt;
      });
      const statements = inWindow.map((lead) => db.prepare(`
        INSERT INTO leads (pancake_page_id, conversation_id, customer_id, customer_name, channel, stage, product_tags, location_tags, assigned_agent_id, assigned_agent_name, first_inbound_at, last_interaction_at, sold_at, raw_tags, has_conflict, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(pancake_page_id, conversation_id) DO UPDATE SET
          customer_id=excluded.customer_id, customer_name=excluded.customer_name, channel=excluded.channel,
          stage=excluded.stage, product_tags=excluded.product_tags, location_tags=excluded.location_tags,
          assigned_agent_id=excluded.assigned_agent_id, assigned_agent_name=excluded.assigned_agent_name,
          first_inbound_at=COALESCE(leads.first_inbound_at, excluded.first_inbound_at), last_interaction_at=excluded.last_interaction_at,
          stage_changed_at=CASE WHEN leads.stage IS NOT excluded.stage THEN CURRENT_TIMESTAMP ELSE leads.stage_changed_at END,
          sold_at=CASE WHEN excluded.stage='sold' AND leads.stage IS NOT 'sold' THEN CURRENT_TIMESTAMP WHEN excluded.stage<>'sold' THEN NULL ELSE leads.sold_at END,
          stage=excluded.stage, raw_tags=excluded.raw_tags, has_conflict=excluded.has_conflict, updated_at=CURRENT_TIMESTAMP
      `).bind(lead.pageId, lead.conversationId, lead.customerId, lead.customerName, lead.channel, lead.stage, JSON.stringify(lead.products), JSON.stringify(lead.locations), lead.assignedAgentId, lead.assignedAgentName, lead.firstInboundAt, lead.lastInteractionAt, null, JSON.stringify(lead.rawTags), lead.hasConflict ? 1 : 0));
      if (statements.length) await db.batch(statements);

      const dated = leads.map((lead) => lead.lastInteractionAt ?? lead.firstInboundAt).filter(Boolean) as string[];
      const oldestAt = dated.sort()[0] ?? null;
      const nextCursor = leads.at(-1)?.conversationId ?? cursor ?? null;
      const done = conversations.length < 60 || Boolean(oldestAt && oldestAt <= cutoffAt) || !nextCursor || nextCursor === cursor;
      const totalImported = Number(state?.conversations_imported ?? 0) + inWindow.length;
      await db.prepare(`INSERT INTO pancake_backfill_state (page_id, cursor, oldest_at, cutoff_at, conversations_imported, completed, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(page_id) DO UPDATE SET cursor=excluded.cursor, oldest_at=excluded.oldest_at, cutoff_at=excluded.cutoff_at,
        conversations_imported=excluded.conversations_imported, completed=excluded.completed, updated_at=CURRENT_TIMESTAMP`)
        .bind(page.pageId, nextCursor, oldestAt, cutoffAt, totalImported, done ? 1 : 0).run();
      results.push({ number: page.number, done, imported: inWindow.length, totalImported, oldestAt });
    } catch (error) {
      results.push({ number: page.number, done: false, imported: 0, error: error instanceof Error ? error.message : "Backfill failed" });
    }
  }

  const done = results.every((result) => result.done);
  return Response.json({ ok: results.every((result) => !result.error), done, months, results });
}
