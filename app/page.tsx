"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type DashboardData = {
  summary: { total: number; sold: number; attention: number };
  stages: Array<{ stage: string; value: number }>;
  products: Array<{ name: string; value: number }>;
  agents: Array<{ agent: string; conversations: number; sold: number }>;
  sync?: { finished_at?: string; status?: string; error_message?: string } | null;
};

const stageLabels: Record<string, string> = { engaged: "Engaged", hot_lead: "Hot lead", form_pending: "Form pending", buy_later: "Buy later", sold: "Sold", lost: "Lost", unclassified: "Unclassified" };
const emptyData: DashboardData = { summary: { total: 0, sold: 0, attention: 0 }, stages: [], products: [], agents: [], sync: null };

export default function Home() {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("Loading live dataâ€¦");

  const load = useCallback(async () => {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    if (!response.ok) throw new Error("Dashboard data is unavailable");
    const next = await response.json() as DashboardData;
    setData(next);
    setLoading(false);
    setMessage(next.summary.total ? "Live Pancake data" : "Waiting for a successful Pancake import");
  }, []);

  useEffect(() => { load().catch(() => { setLoading(false); setMessage("Dashboard data is unavailable"); }); }, [load]);

  const soldRate = data.summary.total ? ((data.summary.sold / data.summary.total) * 100).toFixed(1) : "0.0";
  const maxStage = Math.max(...data.stages.map((item) => Number(item.value)), 1);
  const maxProduct = Math.max(...data.products.map((item) => Number(item.value)), 1);
  const lastUpdated = useMemo(() => data.sync?.finished_at ? new Date(data.sync.finished_at).toLocaleString() : "No completed import yet", [data.sync]);

  async function sync() {
    setSyncing(true);
    setMessage("Importing from all eight pagesâ€¦");
    try {
      const response = await fetch("/api/pancake/sync", { method: "POST" });
      const result = await response.json() as { ok?: boolean; connected?: number; total?: number; results?: Array<{ error?: string }> };
      if (!result.ok) {
        const firstError = result.results?.find((item) => item.error)?.error;
        setMessage(`${result.connected ?? 0}/${result.total ?? 8} pages imported${firstError ? ` Â· ${firstError}` : ""}`);
      } else setMessage("All eight pages imported successfully");
      await load();
    } catch { setMessage("Import could not be completed"); }
    finally { setSyncing(false); }
  }

  return (
    <main className="appShell">
      <aside className="sidebar">
        <div className="brand"><span>H</span><div><strong>Hatch</strong><small>Operations</small></div></div>
        <nav aria-label="Dashboard sections">
          <a className="active" href="#overview">Overview</a><a href="#pipeline">Pipeline</a><a href="#products">Products</a><a href="#agents">Agents</a>
        </nav>
        <div className="sideStatus"><i/><div><strong>{message}</strong><small>{lastUpdated}</small></div></div>
      </aside>

      <section className="workspace" id="overview">
        <header className="topbar">
          <div><p className="eyebrow">Live sales workspace</p><h1>Good morning</h1><p>One calm view across your eight Pancake pages.</p></div>
          <button className="syncButton" onClick={sync} disabled={syncing}>{syncing ? "Importingâ€¦" : "Refresh Pancake data"}</button>
        </header>

        <div className={data.summary.total ? "statusBanner live" : "statusBanner waiting"}><span/><div><strong>{message}</strong><p>{data.summary.total ? `Updated ${lastUpdated}` : "Replace the saved credentials with Pancake Page Access Tokens from Settings â†’ Tools."}</p></div></div>

        <section className="kpis" aria-label="Key performance indicators">
          <article><span>Total conversations</span><strong>{loading ? "â€”" : data.summary.total.toLocaleString()}</strong><small>Imported from Pancake</small></article>
          <article><span>Sold</span><strong>{loading ? "â€”" : data.summary.sold.toLocaleString()}</strong><small>{soldRate}% conversion</small></article>
          <article><span>Needs attention</span><strong>{loading ? "â€”" : data.summary.attention.toLocaleString()}</strong><small>Conflicts or unclassified</small></article>
          <article><span>Connected pages</span><strong>{data.summary.total ? "8" : "0"}<em>/8</em></strong><small>With valid Pancake feeds</small></article>
        </section>

        <div className="dashboardGrid">
          <article className="card pipeline" id="pipeline">
            <div className="cardHead"><div><p className="eyebrow">Customer journey</p><h2>Lead pipeline</h2></div><span>Live tags</span></div>
            {data.stages.length ? <div className="bars">{data.stages.map((item) => <div className="barRow" key={item.stage}><div><span>{stageLabels[item.stage] ?? item.stage}</span><b>{Number(item.value).toLocaleString()}</b></div><i><span style={{ width: `${Math.max(4, Number(item.value) / maxStage * 100)}%` }}/></i></div>)}</div> : <Empty text="Pipeline data will appear after the first successful import." />}
          </article>

          <article className="card summaryCard">
            <div className="cardHead"><div><p className="eyebrow">Todayâ€™s focus</p><h2>Data health</h2></div></div>
            <div className="healthNumber"><strong>{data.summary.total ? Math.max(0, 100 - Math.round(data.summary.attention / data.summary.total * 100)) : 0}</strong><span>/100</span></div>
            <p className="healthCopy">Keep stage and product tags tidy so every conversation lands in the right report.</p>
            <div className="healthLine"><span>Unresolved records</span><b>{data.summary.attention}</b></div>
          </article>

          <article className="card" id="products">
            <div className="cardHead"><div><p className="eyebrow">Demand signals</p><h2>Product interest</h2></div></div>
            {data.products.length ? <div className="productList">{data.products.map((item) => <div key={item.name}><div><span>{item.name.replace(/^P_/, "")}</span><b>{item.value}</b></div><i><span style={{ width: `${item.value / maxProduct * 100}%` }}/></i></div>)}</div> : <Empty text="Product tags will appear here." />}
          </article>

          <article className="card" id="agents">
            <div className="cardHead"><div><p className="eyebrow">Team activity</p><h2>Agent conversion</h2></div></div>
            {data.agents.length ? <div className="agentTable"><div className="tableHead"><span>Agent</span><span>Chats</span><span>Sold</span><span>Rate</span></div>{data.agents.map((agent) => <div className="tableRow" key={agent.agent}><span><i>{agent.agent.slice(0, 2).toUpperCase()}</i>{agent.agent}</span><b>{agent.conversations}</b><b>{agent.sold}</b><strong>{agent.conversations ? (agent.sold / agent.conversations * 100).toFixed(1) : "0.0"}%</strong></div>)}</div> : <Empty text="Agent assignments will appear here." />}
          </article>
        </div>
      </section>
    </main>
  );
}

function Empty({ text }: { text: string }) { return <div className="emptyState"><span>â—‹</span><p>{text}</p></div>; }
