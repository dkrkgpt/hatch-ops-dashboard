import { database } from "../../../lib/pancake";
import { pageName } from "../../../lib/page-names";

const rangeDays = { today: 1, "7d": 7, "30d": 30, "90d": 90, "180d": 180 } as const;
type RangeKey = keyof typeof rangeDays;

function rangeBounds(range: RangeKey, customStart?: string | null, customEnd?: string | null) {
  const end = new Date();
  if (customStart && customEnd) {
    const start = new Date(`${customStart}T00:00:00.000Z`);
    const customEndExclusive = new Date(`${customEnd}T00:00:00.000Z`);
    customEndExclusive.setUTCDate(customEndExclusive.getUTCDate() + 1);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(customEndExclusive.getTime()) && start < customEndExclusive) {
      const previousStart = new Date(start.getTime() - (customEndExclusive.getTime() - start.getTime()));
      return { start: start.toISOString(), end: customEndExclusive.toISOString(), previousStart: previousStart.toISOString(), custom: true };
    }
  }
  if (range === "today") {
    const localNow = new Date(end.getTime() + 8 * 60 * 60 * 1000);
    const start = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate()) - 8 * 60 * 60 * 1000);
    const previousStart = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    return { start: start.toISOString(), end: end.toISOString(), previousStart: previousStart.toISOString(), custom: false };
  }
  const start = new Date(end);
  if (range === "90d" || range === "180d") start.setUTCMonth(start.getUTCMonth() - (range === "90d" ? 3 : 6));
  else start.setUTCDate(start.getUTCDate() - rangeDays[range]);
  const previousStart = new Date(start.getTime() - (end.getTime() - start.getTime()));
  return { start: start.toISOString(), end: end.toISOString(), previousStart: previousStart.toISOString(), custom: false };
}

export async function GET(request: Request) {
  try {
  const db = database();
  const url = new URL(request.url);
  const requestedRange = url.searchParams.get("range") as RangeKey | null;
  const range: RangeKey = requestedRange && requestedRange in rangeDays ? requestedRange : "180d";
  const selectedPage = url.searchParams.get("page") ?? "all";
  const selectedPlatform = url.searchParams.get("platform") ?? "all";
  const { start, end, previousStart, custom } = rangeBounds(range, url.searchParams.get("start"), url.searchParams.get("end"));
  const activity = "COALESCE(last_interaction_at, first_inbound_at)";
  const platformClause = selectedPlatform === "all" ? "" : " AND platform=?";
  const pageClause = selectedPage === "all" ? "" : " AND COALESCE(external_account_id,pancake_page_id)=?";
  const filters = [...(selectedPlatform === "all" ? [] : [selectedPlatform]), ...(selectedPage === "all" ? [] : [selectedPage])];
  const bind = <T extends D1PreparedStatement>(statement: T, ...dates: string[]) => statement.bind(...dates, ...filters);
  const currentWhere = `${activity} >= ? AND ${activity} < ? AND COALESCE(channel, '') <> 'COMMENT'${platformClause}${pageClause}`;
  const previousWhere = `${activity} >= ? AND ${activity} < ? AND COALESCE(channel, '') <> 'COMMENT'${platformClause}${pageClause}`;

  const [summary, previous, verifiedCurrent, verifiedPrevious, verifiedAgents, verifiedPreviousAgents, verifiedPages, verifiedProducts, verifiedTrend, comments, stages, productRows, rawTags, agents, previousAgents, agentPages, trend, sync, pageHealth, pageRows, reasons, platformRows] = await Promise.all([
    bind(db.prepare(`SELECT COUNT(*) total, SUM(stage='sold') sold, SUM(stage='unclassified') unclassified, SUM(raw_tags='[]') untagged,
      SUM(has_conflict=1) conflicts, SUM(raw_tags='[]' OR has_conflict=1) attention,
      SUM(assigned_agent_id IS NULL) unassigned FROM leads WHERE ${currentWhere}`), start, end).first(),
    bind(db.prepare(`SELECT COUNT(*) total, SUM(stage='sold') sold, SUM(stage='unclassified') unclassified, SUM(raw_tags='[]') untagged,
      SUM(has_conflict=1) conflicts, SUM(raw_tags='[]' OR has_conflict=1) attention,
      SUM(assigned_agent_id IS NULL) unassigned FROM leads WHERE ${previousWhere}`), previousStart, start).first(),
    bind(db.prepare(`SELECT COUNT(*) total FROM verified_sales WHERE sold_at>=? AND sold_at<?${platformClause}${pageClause}`), start, end).first(),
    bind(db.prepare(`SELECT COUNT(*) total FROM verified_sales WHERE sold_at>=? AND sold_at<?${platformClause}${pageClause}`), previousStart, start).first(),
    bind(db.prepare(`SELECT COALESCE(agent_name,'Unassigned') agent, COUNT(*) sold FROM verified_sales WHERE sold_at>=? AND sold_at<?${platformClause}${pageClause} GROUP BY COALESCE(agent_name,'Unassigned')`), start, end).all(),
    bind(db.prepare(`SELECT COALESCE(agent_name,'Unassigned') agent, COUNT(*) sold FROM verified_sales WHERE sold_at>=? AND sold_at<?${platformClause}${pageClause} GROUP BY COALESCE(agent_name,'Unassigned')`), previousStart, start).all(),
    bind(db.prepare(`SELECT pancake_page_id, COUNT(*) sold FROM verified_sales WHERE sold_at>=? AND sold_at<?${platformClause}${pageClause} GROUP BY pancake_page_id`), start, end).all(),
    bind(db.prepare(`SELECT product_tags FROM verified_sales WHERE sold_at>=? AND sold_at<?${platformClause}${pageClause}`), start, end).all(),
    bind(db.prepare(`SELECT substr(datetime(sold_at,'+8 hours'),1,10) day, COUNT(*) sold FROM verified_sales WHERE sold_at>=? AND sold_at<?${platformClause}${pageClause} GROUP BY substr(datetime(sold_at,'+8 hours'),1,10)`), start, end).all(),
    bind(db.prepare(`SELECT COUNT(*) total FROM leads WHERE ${activity} >= ? AND ${activity} < ? AND channel='COMMENT'${platformClause}${pageClause}`), start, end).first(),
    bind(db.prepare(`SELECT stage, COUNT(*) value FROM leads WHERE ${currentWhere} GROUP BY stage ORDER BY value DESC`), start, end).all(),
    bind(db.prepare(`SELECT product_tags, stage FROM leads WHERE ${currentWhere} AND product_tags <> '[]'`), start, end).all(),
    bind(db.prepare(`SELECT raw_tags FROM leads WHERE ${currentWhere} AND raw_tags <> '[]'`), start, end).all(),
    bind(db.prepare(`SELECT CASE WHEN assigned_agent_id IS NULL THEN 'Unassigned' WHEN assigned_agent_name IS NULL THEN 'Former / unknown agent' ELSE assigned_agent_name END agent,
      COUNT(*) conversations, SUM(stage='sold') sold, SUM(raw_tags='[]') untagged FROM leads WHERE ${currentWhere}
      GROUP BY CASE WHEN assigned_agent_id IS NULL THEN 'Unassigned' WHEN assigned_agent_name IS NULL THEN 'Former / unknown agent' ELSE assigned_agent_name END
      ORDER BY conversations DESC LIMIT 12`), start, end).all(),
    bind(db.prepare(`SELECT CASE WHEN assigned_agent_id IS NULL THEN 'Unassigned' WHEN assigned_agent_name IS NULL THEN 'Former / unknown agent' ELSE assigned_agent_name END agent,
      COUNT(*) conversations, SUM(stage='sold') sold FROM leads WHERE ${previousWhere}
      GROUP BY CASE WHEN assigned_agent_id IS NULL THEN 'Unassigned' WHEN assigned_agent_name IS NULL THEN 'Former / unknown agent' ELSE assigned_agent_name END`), previousStart, start).all(),
    bind(db.prepare(`SELECT CASE WHEN assigned_agent_id IS NULL THEN 'Unassigned' WHEN assigned_agent_name IS NULL THEN 'Former / unknown agent' ELSE assigned_agent_name END agent,
      pancake_page_id, COUNT(*) conversations FROM leads WHERE ${currentWhere}
      GROUP BY CASE WHEN assigned_agent_id IS NULL THEN 'Unassigned' WHEN assigned_agent_name IS NULL THEN 'Former / unknown agent' ELSE assigned_agent_name END, pancake_page_id`), start, end).all(),
    bind(db.prepare(`SELECT substr(${activity},1,10) day, COUNT(*) conversations, SUM(stage='sold') sold FROM leads
      WHERE ${currentWhere} GROUP BY substr(${activity},1,10) ORDER BY day`), start, end).all(),
    db.prepare("SELECT finished_at, status, conversations_read, leads_updated, error_message FROM sync_runs ORDER BY id DESC LIMIT 1").first(),
    db.prepare(`SELECT p.id, p.last_synced_at, COALESCE((SELECT status FROM sync_runs s WHERE s.page_id=p.id ORDER BY s.id DESC LIMIT 1),'unknown') status,
      COALESCE((SELECT error_message FROM sync_runs s WHERE s.page_id=p.id ORDER BY s.id DESC LIMIT 1),'') error_message FROM pancake_pages p WHERE p.enabled=1`).all(),
    db.prepare(`SELECT pancake_page_id, COUNT(*) conversations, SUM(stage='sold') sold, SUM(raw_tags='[]') untagged,
      SUM(assigned_agent_id IS NULL) unassigned FROM leads WHERE ${activity} >= ? AND ${activity} < ? AND COALESCE(channel,'') <> 'COMMENT'
      GROUP BY pancake_page_id ORDER BY conversations DESC`).bind(start, end).all(),
    bind(db.prepare(`SELECT CASE
      WHEN raw_tags='[]' THEN 'No tags'
      WHEN product_tags<>'[]' THEN 'Product tag only'
      WHEN raw_tags LIKE '%FU_%' THEN 'Follow-up tag only'
      WHEN location_tags<>'[]' THEN 'Location tag only'
      ELSE 'Unrecognized tags' END reason, COUNT(*) value
      FROM leads WHERE ${currentWhere} AND (raw_tags='[]' OR stage='unclassified') GROUP BY reason ORDER BY value DESC`), start, end).all(),
    bind(db.prepare(`SELECT platform, COUNT(*) conversations, SUM(stage='sold') sold, SUM(assigned_agent_id IS NULL) unassigned
      FROM leads WHERE ${currentWhere} GROUP BY platform ORDER BY conversations DESC`), start, end).all(),
  ]);

  const products = productPerformance(productRows.results as Array<{ product_tags: string; stage: string }>, verifiedProducts.results as Array<{ product_tags: string }>);
  const tagCounts = countJsonValues(rawTags.results as Array<{ raw_tags: string }>, "raw_tags");
  const pages = (pageHealth.results as Array<{ id: string; last_synced_at: string | null; status: string; error_message: string }>).map((page) => ({ ...page, name: pageName(page.id) }));
  const verifiedPageMap = new Map((verifiedPages.results as Array<{ pancake_page_id: string; sold: number }>).map((row) => [row.pancake_page_id, Number(row.sold)]));
  const pagePerformance = (pageRows.results as Array<{ pancake_page_id: string; conversations: number; sold: number; untagged: number; unassigned: number }>).map((page) => ({ ...page, sold: verifiedPageMap.get(page.pancake_page_id) ?? 0, name: pageName(page.pancake_page_id) }));
  const currentSummary = numericSummary(summary);
  const previousSummary = numericSummary(previous);
  currentSummary.sold = Number(verifiedCurrent?.total ?? 0);
  previousSummary.sold = Number(verifiedPrevious?.total ?? 0);
  const currentAgentRows = mergeAgentSales(agents.results as Array<{ agent: string; conversations: number; sold: number; untagged: number }>, verifiedAgents.results as Array<{ agent: string; sold: number }>);
  const previousAgentRows = mergeAgentSales(previousAgents.results as Array<{ agent: string; conversations: number; sold: number; untagged: number }>, verifiedPreviousAgents.results as Array<{ agent: string; sold: number }>);
  const verifiedTrendMap = new Map((verifiedTrend.results as Array<{ day: string; sold: number }>).map((row) => [row.day, Number(row.sold)]));
  const accurateTrend = (trend.results as Array<{ day: string; conversations: number; sold: number }>).map((row) => ({ ...row, sold: verifiedTrendMap.get(row.day) ?? 0 }));

  return Response.json({
    range: { key: range, days: rangeDays[range], cutoff: start, end, custom }, selectedPage, selectedPlatform,
    summary: { ...currentSummary, comments: Number(comments?.total ?? 0), connected: pages.filter((page) => page.status === "success").length, pages: pages.length },
    previous: previousSummary,
    changes: Object.fromEntries(Object.keys(currentSummary).map((key) => [key,
      previousSummary.total >= currentSummary.total * 0.1 ? percentChange(currentSummary[key as keyof typeof currentSummary], previousSummary[key as keyof typeof previousSummary]) : null
    ])),
    stages: stages.results, products, tags: topEntries(tagCounts, 12), agents: agentPerformance(
      currentAgentRows,
      previousAgentRows,
      currentSummary.sold,
      previousSummary.total >= currentSummary.total * 0.1,
      agentPages.results as Array<{ agent: string; pancake_page_id: string; conversations: number }>,
      pageRows.results as Array<{ pancake_page_id: string; conversations: number; sold: number }>,
    ),
    trend: accurateTrend, pageHealth: pages, pagePerformance, platformPerformance: platformRows.results, unclassifiedReasons: reasons.results, sync,
  });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dashboard query failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

function numericSummary(row: Record<string, unknown> | null) {
  return { total: Number(row?.total ?? 0), sold: Number(row?.sold ?? 0), unclassified: Number(row?.unclassified ?? 0), untagged: Number(row?.untagged ?? 0), conflicts: Number(row?.conflicts ?? 0), attention: Number(row?.attention ?? 0), unassigned: Number(row?.unassigned ?? 0) };
}
function percentChange(current: number, previous: number) { return previous ? (current - previous) / previous * 100 : current ? 100 : 0; }
function countJsonValues<T extends Record<string, string>>(rows: T[], key: keyof T) { const counts = new Map<string, number>(); for (const row of rows) { try { for (const name of JSON.parse(row[key])) counts.set(name, (counts.get(name) ?? 0) + 1); } catch {} } return counts; }
function topEntries(counts: Map<string, number>, limit: number) { return [...counts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, limit); }
function productPerformance(rows: Array<{ product_tags: string; stage: string }>, sales: Array<{ product_tags: string }>) { const counts = new Map<string, { value: number; sold: number }>(); for (const row of rows) { try { for (const name of JSON.parse(row.product_tags)) { const item = counts.get(name) ?? { value: 0, sold: 0 }; item.value += 1; counts.set(name, item); } } catch {} } for (const row of sales) { try { for (const name of JSON.parse(row.product_tags)) { const item = counts.get(name) ?? { value: 0, sold: 0 }; item.sold += 1; counts.set(name, item); } } catch {} } return [...counts.entries()].map(([name, item]) => ({ name, ...item, rate: item.value ? item.sold / item.value * 100 : 0 })).sort((a,b) => b.value-a.value).slice(0,8); }
function mergeAgentSales<T extends { agent: string; sold: number }>(rows: T[], sales: Array<{ agent: string; sold: number }>) { const sold = new Map(sales.map((row) => [row.agent, Number(row.sold)])); return rows.map((row) => ({ ...row, sold: sold.get(row.agent) ?? 0 })); }
function agentPerformance(current: Array<{ agent: string; conversations: number; sold: number; untagged: number }>, previous: Array<{ agent: string; conversations: number; sold: number }>, totalSold: number, comparisonAvailable: boolean, agentPages: Array<{ agent: string; pancake_page_id: string; conversations: number }>, pageRows: Array<{ pancake_page_id: string; conversations: number; sold: number }>) { const prior = new Map(previous.map((row) => [row.agent, row])); const pageRates = new Map(pageRows.map((row) => [row.pancake_page_id, Number(row.conversations) ? Number(row.sold)/Number(row.conversations) : 0])); const expected = new Map<string,number>(); for (const row of agentPages) expected.set(row.agent,(expected.get(row.agent)??0)+Number(row.conversations)*(pageRates.get(row.pancake_page_id)??0)); return current.map((row) => { const old = prior.get(row.agent); const conversations = Number(row.conversations); const sold = Number(row.sold); const previousSold = Number(old?.sold ?? 0); const rate = conversations ? sold/conversations*100 : 0; const expectedRate = conversations ? (expected.get(row.agent)??0)/conversations*100 : 0; return { ...row, conversations, sold, untagged: Number(row.untagged), rate, expectedRate, vsExpected: rate-expectedRate, sampleWarning: conversations<100, targetBand: rate>=5?"Stretch":rate>=4?"Target":rate>=3?"Minimum":"Below minimum", salesShare: totalSold ? sold/totalSold*100 : 0, taggingRate: conversations ? (conversations-Number(row.untagged))/conversations*100 : 0, previousConversations: Number(old?.conversations??0), previousSold, salesChange: comparisonAvailable ? (previousSold ? (sold-previousSold)/previousSold*100 : sold?100:0) : null }; }).sort((a,b) => b.sold-a.sold||b.rate-a.rate).map((row,index)=>({...row,rank:index+1})); }
