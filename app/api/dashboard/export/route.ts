import { database } from "../../../../lib/pancake";
import { pageName } from "../../../../lib/page-names";

const rangeDays: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "180d": 180 };

function bounds(url: URL) {
  const requestedStart = url.searchParams.get("start");
  const requestedEnd = url.searchParams.get("end");
  if (requestedStart && requestedEnd) {
    const start = new Date(`${requestedStart}T00:00:00.000Z`);
    const end = new Date(`${requestedEnd}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start < end) return { start, end };
  }
  const end = new Date();
  const start = new Date(end);
  const range = url.searchParams.get("range") ?? "180d";
  if (range === "today") {
    const localNow = new Date(end.getTime() + 8 * 60 * 60 * 1000);
    start.setTime(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate()) - 8 * 60 * 60 * 1000);
  } else if (range === "90d" || range === "180d") start.setUTCMonth(start.getUTCMonth() - (range === "90d" ? 3 : 6));
  else start.setUTCDate(start.getUTCDate() - (rangeDays[range] ?? 180));
  return { start, end };
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function tagText(value: unknown) {
  try { return (JSON.parse(String(value ?? "[]")) as string[]).join(", "); } catch { return ""; }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { start, end } = bounds(url);
  const selectedPage = url.searchParams.get("page") ?? "all";
  const pageClause = selectedPage === "all" ? "" : " AND pancake_page_id=?";
  const rows = await database().prepare(`SELECT pancake_page_id, conversation_id, customer_name, channel, stage,
    assigned_agent_name, product_tags, location_tags, raw_tags, first_inbound_at, last_interaction_at
    FROM leads WHERE COALESCE(last_interaction_at,first_inbound_at)>=? AND COALESCE(last_interaction_at,first_inbound_at)<?
    AND COALESCE(channel,'')<>'COMMENT'${pageClause}
    ORDER BY COALESCE(last_interaction_at,first_inbound_at) DESC LIMIT 50000`)
    .bind(start.toISOString(), end.toISOString(), ...(selectedPage === "all" ? [] : [selectedPage])).all();

  const header = ["Source page", "Customer", "Owner", "Stage", "Channel", "Products", "Locations", "All tags", "First inbound", "Last activity", "Conversation reference"];
  const lines = [header.map(csvCell).join(",")];
  for (const row of rows.results as Array<Record<string, unknown>>) {
    lines.push([
      pageName(String(row.pancake_page_id)), row.customer_name, row.assigned_agent_name ?? "Unassigned", row.stage,
      row.channel, tagText(row.product_tags), tagText(row.location_tags), tagText(row.raw_tags),
      row.first_inbound_at, row.last_interaction_at, row.conversation_id,
    ].map(csvCell).join(","));
  }
  const filename = `hatch-report-${start.toISOString().slice(0,10)}-to-${new Date(end.getTime()-86400000).toISOString().slice(0,10)}.csv`;
  return new Response(`\uFEFF${lines.join("\r\n")}`, { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  } });
}
