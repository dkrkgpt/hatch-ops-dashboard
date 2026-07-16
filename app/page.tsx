"use client";

import { useMemo, useState } from "react";

const funnel = [
  { label: "Engaged", value: 212, tone: "cyan" },
  { label: "Hot lead", value: 57, tone: "amber" },
  { label: "Form pending", value: 31, tone: "violet" },
  { label: "Buy later", value: 24, tone: "blue" },
  { label: "Sold", value: 18, tone: "green" },
];

const products = [
  { name: "Variscar", value: 183, share: 73 },
  { name: "Lotion", value: 58, share: 23 },
  { name: "Bundle", value: 10, share: 4 },
  { name: "Other products", value: 9, share: 3.6 },
];

const agents = [
  { initials: "AM", name: "Anne M.", conversations: 86, sold: 8, rate: "9.3%" },
  { initials: "JR", name: "Jean R.", conversations: 71, sold: 5, rate: "7.0%" },
  { initials: "KC", name: "Kim C.", conversations: 55, sold: 5, rate: "9.1%" },
];

const exceptions = [
  { level: "High", title: "Conflicting stage tags", detail: "2 leads have SOLD together with an earlier active stage", count: 2 },
  { level: "Medium", title: "Missing product tag", detail: "Active conversations need product classification", count: 14 },
  { level: "Medium", title: "Follow-up overdue", detail: "Buy Later and Form Pending leads past follow-up date", count: 9 },
];

export default function Home() {
  const [range, setRange] = useState("Last 7 days");
  const [view, setView] = useState("Overview");
  const [synced, setSynced] = useState(false);
  const [syncLabel, setSyncLabel] = useState("Sync now");
  const headline = useMemo(() => range === "Last 7 days" ? "July 8â€“15, 2026" : range, [range]);

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brandMark">H</span><div><strong>HATCH</strong><small>OPERATIONS</small></div></div>
        <nav aria-label="Dashboard sections">
          {["Overview", "Lead funnel", "Agents", "Products", "Buy later", "Data quality"].map((item) => (
            <button key={item} className={view === item ? "navItem active" : "navItem"} onClick={() => setView(item)}>
              <span className="navDot" />{item}
              {item === "Data quality" && <b className="badge">25</b>}
            </button>
          ))}
        </nav>
        <div className="sidebarFoot">
          <div className="syncMini"><span className="statusDot"/><div><strong>Pancake sync</strong><small>{synced ? "Updated just now" : "Updated 4 min ago"}</small></div></div>
          <div className="manager"><span>MA</span><div><strong>Management</strong><small>Admin access</small></div></div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">Executive command center</p><h1>{view}</h1><p className="subtitle">{headline} Â· Hong Kong page Â· All agents</p></div>
          <div className="actions">
            <select aria-label="Reporting period" value={range} onChange={(e) => setRange(e.target.value)}>
              <option>Last 7 days</option><option>This month</option><option>Last 30 days</option>
            </select>
            <button className="syncButton" onClick={async () => {
              setSyncLabel("Checkingâ€¦");
              try {
                const response = await fetch("/api/pancake/connection", { method: "POST" });
                const result = await response.json() as { ok?: boolean };
                setSynced(Boolean(result.ok));
                setSyncLabel(result.ok ? "Connected" : "Token required");
              } catch { setSyncLabel("Connection unavailable"); }
            }}>{syncLabel}</button>
          </div>
        </header>

        <div className="notice"><span className="pulse"/><strong>Pancake data layer prepared</strong><p>Lead storage, stage history, conflict detection, and the connection test are ready. Add the page token securely to begin synchronization.</p></div>

        <section className="kpis" aria-label="Key performance indicators">
          <article><span>New customers</span><strong>240</strong><small className="positive">â†‘ 12.1% vs prior period</small></article>
          <article><span>Total engagements</span><strong>471</strong><small>212 new Â· 231 returning</small></article>
          <article><span>Sold</span><strong>18</strong><small className="positive">7.5% of new customers</small></article>
          <article><span>Needs attention</span><strong>25</strong><small className="warning">9 overdue follow-ups</small></article>
        </section>

        <div className="gridMain">
          <article className="panel funnelPanel">
            <div className="panelHead"><div><p className="eyebrow">Sales pipeline</p><h2>Lead funnel</h2></div><span className="provisional">Provisional baseline</span></div>
            <div className="funnel">
              {funnel.map((stage, index) => <div className="funnelRow" key={stage.label}>
                <div className="funnelMeta"><span>{stage.label}</span><b>{stage.value}</b></div>
                <div className="track"><div className={`fill ${stage.tone}`} style={{width: `${Math.max(10, stage.value / 2.12)}%`}}/></div>
                {index < funnel.length - 1 && <small>{Math.round((funnel[index + 1].value / stage.value) * 100)}% progressed</small>}
              </div>)}
            </div>
            <div className="legend"><span><i className="greenDot"/>18 Sold</span><span><i className="redDot"/>Stage conflicts flagged separately</span></div>
          </article>

          <article className="panel qualityPanel">
            <div className="panelHead"><div><p className="eyebrow">Action required</p><h2>Data quality</h2></div><button onClick={() => setView("Data quality")}>View all</button></div>
            <div className="score"><div className="scoreRing"><strong>89</strong><small>/100</small></div><div><b>Good foundation</b><p>Most conversations can be classified automatically.</p></div></div>
            <div className="exceptionList">{exceptions.map((item) => <div className="exception" key={item.title}><span className={`severity ${item.level.toLowerCase()}`}>{item.level}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div><b>{item.count}</b></div>)}</div>
          </article>

          <article className="panel productsPanel">
            <div className="panelHead"><div><p className="eyebrow">Demand signals</p><h2>Product interest</h2></div><small>Tag activity</small></div>
            <div className="productList">{products.map((p, i) => <div className="product" key={p.name}><span>{i + 1}</span><div><div><strong>{p.name}</strong><b>{p.value}</b></div><div className="productTrack"><i style={{width: `${p.share}%`}}/></div></div></div>)}</div>
          </article>

          <article className="panel agentsPanel">
            <div className="panelHead"><div><p className="eyebrow">Team performance</p><h2>Agent conversion</h2></div><small>Uploaded baseline</small></div>
            <div className="table"><div className="tableHeader"><span>Agent</span><span>Engaged</span><span>Sold</span><span>Rate</span></div>{agents.map(a => <div className="tableRow" key={a.name}><span className="agentName"><i>{a.initials}</i>{a.name}</span><span>{a.conversations}</span><span>{a.sold}</span><strong>{a.rate}</strong></div>)}</div>
          </article>
        </div>

        <footer><span>Metrics are based on separate aggregated engagement and tag reports.</span><span>Stage priority: Sold â€º Lost â€º Buy Later â€º Form Pending â€º Hot Lead â€º Engaged</span></footer>
      </section>
    </main>
  );
}

