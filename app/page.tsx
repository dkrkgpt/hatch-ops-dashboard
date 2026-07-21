"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type RangeKey = "7d" | "30d" | "90d" | "180d";
type DashboardData = {
  range: { key: RangeKey; days: number; cutoff: string; end?: string; custom?: boolean };
  selectedPage: string;
  selectedPlatform?: string;
  summary: { total: number; sold: number; attention: number; unclassified: number; untagged: number; conflicts: number; unassigned: number; comments: number; connected: number; pages: number };
  previous: { total: number; sold: number; unclassified: number; untagged: number; conflicts: number; attention: number; unassigned: number };
  changes: Record<string, number | null>;
  stages: Array<{ stage: string; value: number }>;
  products: Array<{ name: string; value: number; sold: number; rate: number }>;
  tags: Array<{ name: string; value: number }>;
  agents: Array<{ agent: string; conversations: number; sold: number; untagged: number; rate: number; expectedRate: number; vsExpected: number; sampleWarning: boolean; targetBand: string; salesShare: number; taggingRate: number; previousConversations: number; previousSold: number; salesChange: number | null; rank: number }>;
  trend: Array<{ day: string; conversations: number; sold: number }>;
  pageHealth: Array<{ id: string; name: string; last_synced_at?: string; status: string; error_message?: string }>;
  pagePerformance: Array<{ pancake_page_id: string; name: string; conversations: number; sold: number; untagged: number; unassigned: number }>;
  platformPerformance?: Array<{ platform: string; conversations: number; sold: number; unassigned: number }>;
  unclassifiedReasons: Array<{ reason: string; value: number }>;
  sync?: { finished_at?: string; status?: string; error_message?: string } | null;
};

const stageLabels: Record<string, string> = { engaged: "Engaged", hot_lead: "Hot lead", form_pending: "Form pending", buy_later: "Buy later", sold: "Sold", lost: "Lost", unclassified: "Unclassified" };
const rangeLabels: Record<RangeKey, string> = { "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 3 months", "180d": "Last 6 months" };
const emptyData: DashboardData = { range: { key: "180d", days: 180, cutoff: "" }, selectedPage: "all", summary: { total: 0, sold: 0, attention: 0, unclassified: 0, untagged: 0, conflicts: 0, unassigned: 0, comments: 0, connected: 0, pages: 8 }, previous: { total: 0, sold: 0, unclassified: 0, untagged: 0, conflicts: 0, attention: 0, unassigned: 0 }, changes: {}, stages: [], products: [], tags: [], agents: [], trend: [], pageHealth: [], pagePerformance: [], unclassifiedReasons: [], sync: null };

type QueueStatus = "untagged" | "unclassified" | "unassigned" | "hot_lead" | "form_pending" | "stale";
type LeadDetail = { pancake_page_id: string; page_name: string; conversation_id: string; customer_name?: string; channel: string; stage: string; assigned_agent_name?: string; product_tags: string; location_tags: string; raw_tags: string; first_inbound_at?: string; last_interaction_at: string; next_follow_up_at?: string };

export default function Home() {
  const [range, setRange] = useState<RangeKey>("180d");
  const [selectedPage, setSelectedPage] = useState("all");
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [message, setMessage] = useState("Loading live data…");
  const [details, setDetails] = useState<{ status: string; rows: LeadDetail[] } | null>(null);

  const reportParams = useCallback((selectedRange: RangeKey = range) => {
    const params = new URLSearchParams({ range: selectedRange, page: selectedPage, platform: selectedPlatform });
    if (startDate && endDate) { params.set("start", startDate); params.set("end", endDate); }
    return params.toString();
  }, [range, selectedPage, selectedPlatform, startDate, endDate]);

  const load = useCallback(async (selectedRange: RangeKey = range) => {
    const response = await fetch(`/api/dashboard?${reportParams(selectedRange)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Dashboard data is unavailable");
    const next = await response.json() as DashboardData;
    setData(next);
    setLoading(false);
    setMessage(next.summary.total ? "Live Pancake data" : "No conversations in this date range");
  }, [range, reportParams]);

  useEffect(() => {
    let active = true;
    void fetch(`/api/dashboard?${reportParams(range)}`, { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : Promise.reject(new Error(((await response.json().catch(() => ({}))) as { error?: string }).error ?? `Dashboard error ${response.status}`)))
      .then((next: DashboardData) => { if (active) { setData(next); setLoading(false); setMessage(next.summary.total ? "Live Pancake data" : "No conversations in this date range"); } })
      .catch((error: Error) => { if (active) { setLoading(false); setMessage(error.message || "Dashboard data is unavailable"); } });
    return () => { active = false; };
  }, [range, reportParams]);

  async function showDetails(status: QueueStatus) {
    const response = await fetch(`/api/dashboard/leads?${reportParams(range)}&status=${status}`, { cache: "no-store" });
    if (response.ok) setDetails(await response.json() as { status: string; rows: LeadDetail[] });
  }

  const soldRate = data.summary.total ? data.summary.sold / data.summary.total * 100 : 0;
  const maxStage = Math.max(...data.stages.map((item) => Number(item.value)), 1);
  const maxProduct = Math.max(...data.products.map((item) => Number(item.value)), 1);
  const lastUpdated = useMemo(() => data.sync?.finished_at ? new Date(data.sync.finished_at).toLocaleString() : "No completed import yet", [data.sync]);
  const topPage = useMemo(() => [...data.pagePerformance].filter((page) => page.conversations >= 20).sort((a,b) => (b.sold / b.conversations) - (a.sold / a.conversations))[0], [data.pagePerformance]);
  const weakestPage = useMemo(() => [...data.pagePerformance].filter((page) => page.conversations >= 20).sort((a,b) => (a.sold / a.conversations) - (b.sold / b.conversations))[0], [data.pagePerformance]);
  const topProduct = data.products[0];
  const taggingRate = data.summary.total ? (data.summary.total - data.summary.untagged) / data.summary.total * 100 : 0;

  async function sync() {
    setSyncing(true);
    setMessage("Importing recent conversations from all eight pages…");
    try {
      const response = await fetch("/api/pancake/sync", { method: "POST" });
      const result = await response.json() as { ok?: boolean; connected?: number; total?: number; results?: Array<{ error?: string }> };
      if (!result.ok) {
        const firstError = result.results?.find((item) => item.error)?.error;
        setMessage(`${result.connected ?? 0}/${result.total ?? 8} pages imported${firstError ? ` · ${firstError}` : ""}`);
      } else setMessage("All eight pages imported successfully");
      await load();
    } catch { setMessage("Import could not be completed"); }
    finally { setSyncing(false); }
  }

  async function backfill() {
    setBackfilling(true);
    setMessage("Checking six months of Pancake history…");
    try {
      let done = false;
      let rounds = 0;
      while (!done) {
        const response = await fetch("/api/pancake/backfill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ months: 6 }) });
        const result = await response.json() as { ok?: boolean; done?: boolean; results?: Array<{ totalImported?: number; error?: string }> };
        if (!response.ok || !result.ok) throw new Error(result.results?.find((item) => item.error)?.error ?? "Backfill failed");
        done = Boolean(result.done);
        rounds += 1;
        const imported = result.results?.reduce((total, item) => total + Number(item.totalImported ?? 0), 0) ?? 0;
        setMessage(done ? `Six-month history ready · ${imported.toLocaleString()} records processed` : `Historical import in progress · ${imported.toLocaleString()} records processed`);
        if (rounds >= 300) throw new Error("Import will continue from its checkpoint");
      }
      await load();
    } catch { setMessage("Historical import paused; select the button again to resume safely"); }
    finally { setBackfilling(false); }
  }

  return <main className="appShell">
    <aside className="sidebar">
      <div className="brand"><span>H</span><div><strong>Hatch</strong><small>Operations</small></div></div>
      <nav aria-label="Dashboard sections"><a className="active" href="#overview">Overview</a><a href="#trend">Trends</a><a href="#pipeline">Pipeline</a><a href="#products">Products</a><a href="#tags">Tags</a><a href="#agents">Agents</a></nav>
      <div className="sideStatus"><i className={data.summary.connected === 8 ? "healthy" : ""}/><div><strong>{message}</strong><small>{lastUpdated}</small></div></div>
    </aside>

    <section className="workspace" id="overview">
      <header className="topbar">
        <div><p className="eyebrow">Live sales workspace</p><h1>Business overview</h1><p>Sales performance across every connected messaging and lead platform.</p></div>
        <div className="topActions"><button className="historyButton" onClick={backfill} disabled={backfilling || syncing}>{backfilling ? "Importing history…" : "Resume 6-month history"}</button><button className="syncButton" onClick={sync} disabled={syncing || backfilling}>{syncing ? "Importing…" : "Refresh data"}</button></div>
      </header>

      <div className="controlBar"><label htmlFor="range">Reporting period</label><select id="range" value={range} onChange={(event) => { setLoading(true); setDetails(null); setStartDate(""); setEndDate(""); setRange(event.target.value as RangeKey); }}>{Object.entries(rangeLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select><label htmlFor="startDate">Start</label><input id="startDate" type="date" value={startDate} max={endDate || undefined} onInput={(event) => { setLoading(true); setDetails(null); setStartDate(event.currentTarget.value); }}/><label htmlFor="endDate">End</label><input id="endDate" type="date" value={endDate} min={startDate || undefined} onInput={(event) => { setLoading(true); setDetails(null); setEndDate(event.currentTarget.value); }}/><label htmlFor="page">Source page</label><select id="page" value={selectedPage} onChange={(event) => { setLoading(true); setDetails(null); setSelectedPage(event.target.value); }}><option value="all">All pages</option>{data.pageHealth.map((page) => <option key={page.id} value={page.id}>{page.name}</option>)}</select><a className="exportButton" href={`/api/dashboard/export?${reportParams(range)}`}>Export for Excel</a><span>{data.range.cutoff ? `${data.range.custom ? "Custom: " : "From "}${new Date(data.range.cutoff).toLocaleDateString()}${data.range.custom && data.range.end ? ` – ${new Date(new Date(data.range.end).getTime()-86400000).toLocaleDateString()}` : ""}` : ""}</span></div>
      <div className={data.summary.connected === data.summary.pages ? "statusBanner live" : "statusBanner waiting"}><span/><div><strong>{message}</strong><p>{data.summary.connected}/{data.summary.pages || 8} pages healthy · Updated {lastUpdated}</p></div></div>
      <div className="feedStrip" aria-label="Pancake page feed health">{data.pageHealth.map((page) => <div className={page.status === "success" ? "feed healthy" : "feed failed"} key={page.id} title={page.error_message || page.last_synced_at || "No sync recorded"}><i/><span>{page.name}</span><b>{page.status === "success" ? "Healthy" : "Check feed"}</b></div>)}</div>

      <section className="kpis" aria-label="Key performance indicators">
        <Kpi label="Private messages" value={loading ? "—" : data.summary.total.toLocaleString()} note={rangeLabels[range]} change={data.changes.total} />
        <Kpi label="Sold" value={loading ? "—" : data.summary.sold.toLocaleString()} note={`${soldRate.toFixed(1)}% conversion`} change={data.changes.sold} />
        <Kpi label="Untagged" value={loading ? "—" : data.summary.untagged.toLocaleString()} note="Needs Pancake tags" change={data.changes.untagged} onClick={() => void showDetails("untagged")} />
        <Kpi label="Unassigned" value={loading ? "—" : data.summary.unassigned.toLocaleString()} note="Select to inspect" change={data.changes.unassigned} onClick={() => void showDetails("unassigned")} />
        <Kpi label="Public comments" value={loading ? "—" : data.summary.comments.toLocaleString()} note="Excluded from lead metrics" />
        <Kpi label="Connected pages" value={`${data.summary.connected}`} suffix={`/${data.summary.pages || 8}`} note="Latest feed status" />
      </section>

      <section className="executiveStrip" aria-label="Executive management insights">
        <div><span>Best converting page</span><strong>{topPage?.name ?? "No data"}</strong><small>{topPage?.conversations ? `${(topPage.sold/topPage.conversations*100).toFixed(1)}% conversion` : "—"}</small></div>
        <div><span>Page needing attention</span><strong>{weakestPage?.name ?? "No data"}</strong><small>{weakestPage?.conversations ? `${(weakestPage.sold/weakestPage.conversations*100).toFixed(1)}% conversion` : "—"}</small></div>
        <div><span>Top product demand</span><strong>{topProduct ? friendlyTag(topProduct.name) : "No data"}</strong><small>{topProduct ? `${topProduct.value.toLocaleString()} interested · ${topProduct.rate.toFixed(1)}% sold` : "—"}</small></div>
        <div><span>Tagging completeness</span><strong>{taggingRate.toFixed(1)}%</strong><small>{data.summary.untagged.toLocaleString()} conversations need tags</small></div>
      </section>

      <div className="dashboardGrid">
        <article className="card trendCard wide" id="trend"><div className="cardHead"><div><p className="eyebrow">Performance over time</p><h2>Conversation trend</h2></div><span>{rangeLabels[range]}</span></div><TrendChart points={data.trend} /></article>
        <article className="card wide"><div className="cardHead"><div><p className="eyebrow">Source performance</p><h2>Messages and sales by page</h2></div><span>Private messages only</span></div><div className="performanceTable"><div className="performanceHead"><span>Source page</span><span>Messages</span><span>Sold</span><span>Conversion</span><span>Untagged</span><span>Unassigned</span></div>{data.pagePerformance.map((page) => <div className="performanceRow" key={page.pancake_page_id}><strong>{page.name}</strong><span>{Number(page.conversations).toLocaleString()}</span><span>{Number(page.sold).toLocaleString()}</span><b>{page.conversations ? (page.sold / page.conversations * 100).toFixed(1) : "0.0"}%</b><span>{Number(page.untagged).toLocaleString()}</span><span>{Number(page.unassigned).toLocaleString()}</span></div>)}</div></article>
        <article className="card pipeline" id="pipeline"><div className="cardHead"><div><p className="eyebrow">Customer journey</p><h2>Lead pipeline</h2></div><span>Stage tags</span></div>{data.stages.length ? <div className="bars">{data.stages.map((item) => <div className="barRow" key={item.stage}><div><span>{stageLabels[item.stage] ?? item.stage}</span><b>{Number(item.value).toLocaleString()}</b></div><i><span style={{ width: `${Math.max(2, Number(item.value) / maxStage * 100)}%` }}/></i></div>)}</div> : <Empty text="No pipeline data in this period." />}</article>
        <article className="card summaryCard"><div className="cardHead"><div><p className="eyebrow">Data quality</p><h2>Tag coverage gaps</h2></div></div>{data.unclassifiedReasons.length ? <div className="reasonList">{data.unclassifiedReasons.map((reason) => <div key={reason.reason}><span>{reason.reason}</span><b>{Number(reason.value).toLocaleString()}</b></div>)}</div> : <Empty text="Every message has usable tags in this period." />}</article>
        <article className="card wide queueCard"><div className="cardHead"><div><p className="eyebrow">Daily workflow</p><h2>Action queues</h2></div><span>Private messages only</span></div><div className="queueButtons"><button onClick={() => void showDetails("untagged")}><strong>Untagged</strong><span>Add a pipeline stage</span></button><button onClick={() => void showDetails("unassigned")}><strong>Unassigned</strong><span>Give an agent ownership</span></button><button onClick={() => void showDetails("hot_lead")}><strong>Hot leads</strong><span>Prioritize sales follow-up</span></button><button onClick={() => void showDetails("form_pending")}><strong>Form pending</strong><span>Complete missing details</span></button><button onClick={() => void showDetails("stale")}><strong>Stale 48h+</strong><span>Re-engage open conversations</span></button></div></article>
        <article className="card" id="products"><div className="cardHead"><div><p className="eyebrow">Demand signals</p><h2>Product conversion</h2></div></div>{data.products.length ? <div className="productList">{data.products.map((item) => <div key={item.name}><div><span>{friendlyTag(item.name)}</span><b>{item.value.toLocaleString()} interested · {item.sold.toLocaleString()} sold · {item.rate.toFixed(1)}%</b></div><i><span style={{ width: `${item.value / maxProduct * 100}%` }}/></i></div>)}</div> : <Empty text="No product tags in this period." />}</article>
        <article className="card" id="tags"><div className="cardHead"><div><p className="eyebrow">Pancake labels</p><h2>Top tags</h2></div></div>{data.tags.length ? <div className="tagList">{data.tags.map((item) => <div key={item.name} title={item.name}><span>{friendlyTag(item.name)}</span><b>{item.value.toLocaleString()}</b></div>)}</div> : <Empty text="No conversation tags in this period." />}</article>
        <article className="card wide" id="agents"><div className="cardHead"><div><p className="eyebrow">Management scorecards</p><h2>Agent performance</h2></div><span>{data.range.custom ? "Custom period" : rangeLabels[range]}</span></div><div className="targetLegend"><span><b>3%</b> minimum</span><span><b>4%</b> target</span><span><b>5%</b> stretch</span><span>Expected rate adjusts for each agent’s page mix</span></div>{data.agents.length ? <div className="agentScorecards">{data.agents.map((agent) => <div className="agentScore" key={agent.agent}><div className="agentIdentity"><i>{initials(agent.agent)}</i><div><b>#{agent.rank} · {agent.agent}</b><span>{agent.salesShare.toFixed(1)}% of team sales · {agent.targetBand}</span></div></div><div className="scoreMetrics"><div><span>Conversations</span><strong>{agent.conversations.toLocaleString()}</strong></div><div><span>Sold</span><strong>{agent.sold.toLocaleString()}</strong></div><div><span>Conversion</span><strong>{agent.rate.toFixed(1)}%</strong></div><div><span>Tagging</span><strong>{agent.taggingRate.toFixed(1)}%</strong></div></div><div className="benchmarkLine"><span>Page-adjusted expectation <b>{agent.expectedRate.toFixed(1)}%</b></span><b className={agent.vsExpected >= 0 ? "positive" : "negative"}>{agent.vsExpected >= 0 ? "+" : ""}{agent.vsExpected.toFixed(1)} pts</b></div>{agent.sampleWarning && <small className="sampleWarning">Small sample: interpret cautiously</small>}<div className={agent.salesChange != null && agent.salesChange > 0 ? "scoreChange up" : agent.salesChange != null && agent.salesChange < 0 ? "scoreChange down" : "scoreChange"}>{agent.salesChange == null ? "Previous-period coverage unavailable" : <>{agent.salesChange > 0 ? "↑" : agent.salesChange < 0 ? "↓" : "–"} {Math.abs(agent.salesChange).toFixed(1)}% sales vs previous period</>}</div></div>)}</div> : <Empty text="No agent activity in this period." />}</article>
        {details && <article className="card wide detailCard"><div className="cardHead"><div><p className="eyebrow">Action list</p><h2>{queueLabel(details.status)} private messages</h2></div><button className="closeButton" onClick={() => setDetails(null)}>Close</button></div><p className="privacyNote">Showing the 50 most recent matching conversations. This information is protected by Cloudflare Access.</p><div className="detailTable"><div className="detailHead"><span>Customer / source</span><span>Owner</span><span>Stage</span><span>Last activity</span><span>Product / location</span><span>Tags</span></div>{details.rows.map((row) => <div className="detailRow" key={`${row.pancake_page_id}:${row.conversation_id}`} title={`Conversation ${row.conversation_id}`}><strong>{row.customer_name || "Unnamed customer"}<small>{row.page_name}</small></strong><span>{row.assigned_agent_name || "Unassigned"}</span><span>{stageLabels[row.stage] ?? friendlyTag(row.stage)}</span><span>{row.last_interaction_at ? new Date(row.last_interaction_at).toLocaleString() : "Unknown"}</span><span>{[safeTags(row.product_tags), safeTags(row.location_tags)].filter((value) => value !== "No tags").join(" · ") || "Not tagged"}</span><span>{safeTags(row.raw_tags)}</span></div>)}</div>{!details.rows.length && <Empty text="No conversations currently need action in this queue." />}</article>}
      </div>
    </section>
  </main>;
}

function Kpi({ label, value, suffix, note, change, onClick }: { label: string; value: string; suffix?: string; note: string; change?: number | null; onClick?: () => void }) { const content = <><span>{label}</span><strong>{value}{suffix && <em>{suffix}</em>}</strong><small>{note}{change != null && <b className={change > 0 ? "up" : change < 0 ? "down" : "flat"}>{change > 0 ? "↑" : change < 0 ? "↓" : "–"} {Math.abs(change).toFixed(1)}%</b>}</small></>; return onClick ? <article className="clickableKpi"><button onClick={onClick}>{content}</button></article> : <article>{content}</article>; }

function TrendChart({ points }: { points: DashboardData["trend"] }) {
  if (!points.length) return <Empty text="Trend data will appear after conversations are imported." />;
  const width = 720, height = 190, pad = 12;
  const max = Math.max(...points.map((point) => Number(point.conversations)), 1);
  const coords = points.map((point, index) => ({ x: pad + index / Math.max(points.length - 1, 1) * (width - pad * 2), y: height - pad - Number(point.conversations) / max * (height - pad * 2) }));
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`;
  return <div className="trendWrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Daily conversations, maximum ${max.toLocaleString()}`} preserveAspectRatio="none"><defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5aa98a" stopOpacity=".35"/><stop offset="1" stopColor="#5aa98a" stopOpacity=".02"/></linearGradient></defs><polygon points={area} fill="url(#trendFill)"/><polyline points={line} fill="none" stroke="#2d7a61" strokeWidth="3" vectorEffect="non-scaling-stroke"/></svg><div className="trendAxis"><span>{new Date(points[0].day).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span><strong>Peak {max.toLocaleString()} conversations/day</strong><span>{new Date(points.at(-1)!.day).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></div></div>;
}

function friendlyTag(value: string) { return value.replace(/^(P_|LOC_|FU_)/, "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function safeTags(value: string) { try { const tags = JSON.parse(value) as string[]; return tags.length ? tags.map(friendlyTag).join(", ") : "No tags"; } catch { return "No tags"; } }
function queueLabel(status: string) { return ({ untagged: "Untagged", unclassified: "Unclassified", unassigned: "Unassigned", hot_lead: "Hot lead", form_pending: "Form pending", stale: "Stale 48h+" } as Record<string, string>)[status] ?? friendlyTag(status); }
function initials(name: string) { const words = name.split(/\s+/).filter(Boolean); return (words.length > 1 ? words[0][0] + words.at(-1)![0] : name.slice(0, 2)).toUpperCase(); }
function Empty({ text }: { text: string }) { return <div className="emptyState"><span>○</span><p>{text}</p></div>; }
