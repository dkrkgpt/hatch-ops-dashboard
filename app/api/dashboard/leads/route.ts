import { database } from "../../../../lib/pancake";
import { pageName } from "../../../../lib/page-names";

const ranges: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "180d": 180 };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const range = url.searchParams.get("range") ?? "7d";
  const requestedStatus = url.searchParams.get("status") ?? "unclassified";
  const allowedStatuses = new Set(["untagged", "unclassified", "unassigned", "hot_lead", "form_pending", "stale"]);
  const status = allowedStatuses.has(requestedStatus) ? requestedStatus : "unclassified";
  const selectedPage = url.searchParams.get("page") ?? "all";
  const cutoff = new Date();
  const end = new Date();
  const requestedStart = url.searchParams.get("start");
  const requestedEnd = url.searchParams.get("end");
  if (requestedStart && requestedEnd) {
    cutoff.setTime(new Date(`${requestedStart}T00:00:00.000Z`).getTime());
    end.setTime(new Date(`${requestedEnd}T00:00:00.000Z`).getTime());
    end.setUTCDate(end.getUTCDate() + 1);
  } else if (range === "today") {
    const localNow = new Date(end.getTime() + 8 * 60 * 60 * 1000);
    cutoff.setTime(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate()) - 8 * 60 * 60 * 1000);
  } else if (range === "90d" || range === "180d") cutoff.setUTCMonth(cutoff.getUTCMonth() - (range === "90d" ? 3 : 6));
  else cutoff.setUTCDate(cutoff.getUTCDate() - (ranges[range] ?? 7));
  const statusClauses: Record<string, string> = {
    untagged: "raw_tags='[]'",
    unassigned: "assigned_agent_id IS NULL",
    unclassified: "stage='unclassified'",
    hot_lead: "stage='hot_lead'",
    form_pending: "stage='form_pending'",
    stale: "stage NOT IN ('sold','lost') AND COALESCE(last_interaction_at,first_inbound_at) < datetime('now','-48 hours')",
  };
  const statusClause = statusClauses[status];
  const pageClause = selectedPage === "all" ? "" : " AND pancake_page_id=?";
  const statement = database().prepare(`SELECT pancake_page_id, conversation_id, customer_name, channel, stage,
    assigned_agent_name, product_tags, location_tags, raw_tags, first_inbound_at, last_interaction_at, next_follow_up_at
    FROM leads WHERE COALESCE(last_interaction_at,first_inbound_at)>=? AND COALESCE(last_interaction_at,first_inbound_at)<? AND COALESCE(channel,'')<>'COMMENT' AND ${statusClause}${pageClause}
    ORDER BY COALESCE(last_interaction_at,first_inbound_at) DESC LIMIT 50`);
  const rows = await statement.bind(cutoff.toISOString(), end.toISOString(), ...(selectedPage === "all" ? [] : [selectedPage])).all();
  return Response.json({ status, rows: (rows.results as Array<Record<string, unknown> & { pancake_page_id: string }>).map((row) => ({ ...row, page_name: pageName(row.pancake_page_id) })) });
}
