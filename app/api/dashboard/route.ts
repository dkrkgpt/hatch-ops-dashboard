import { database } from "../../../lib/pancake";

export async function GET() {
  const db = database();
  const [summary, stages, products, agents, sync] = await Promise.all([
    db.prepare(`SELECT COUNT(*) total, SUM(CASE WHEN stage='sold' THEN 1 ELSE 0 END) sold, SUM(CASE WHEN has_conflict=1 OR stage='unclassified' THEN 1 ELSE 0 END) attention FROM leads`).first(),
    db.prepare("SELECT stage, COUNT(*) value FROM leads GROUP BY stage ORDER BY value DESC").all(),
    db.prepare("SELECT product_tags FROM leads WHERE product_tags <> '[]'").all(),
    db.prepare("SELECT COALESCE(assigned_agent_id, 'Unassigned') agent, COUNT(*) conversations, SUM(CASE WHEN stage='sold' THEN 1 ELSE 0 END) sold FROM leads GROUP BY assigned_agent_id ORDER BY conversations DESC LIMIT 8").all(),
    db.prepare("SELECT finished_at, status, conversations_read, leads_updated, error_message FROM sync_runs ORDER BY id DESC LIMIT 1").first(),
  ]);
  const productCounts = new Map<string, number>();
  for (const row of products.results as Array<{ product_tags: string }>) {
    try { for (const name of JSON.parse(row.product_tags)) productCounts.set(name, (productCounts.get(name) ?? 0) + 1); } catch {}
  }
  return Response.json({
    summary: { total: Number(summary?.total ?? 0), sold: Number(summary?.sold ?? 0), attention: Number(summary?.attention ?? 0) },
    stages: stages.results,
    products: [...productCounts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8),
    agents: agents.results,
    sync,
  });
}
