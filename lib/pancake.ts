import { env } from "cloudflare:workers";
import { classifyLead } from "./lead-stage";

type RuntimeEnv = Record<string, string | undefined> & { DB: D1Database };
type AnyRecord = Record<string, unknown>;

export type PancakePage = { number: number; pageId: string; token: string };

export function configuredPages(): PancakePage[] {
  const config = env as unknown as RuntimeEnv;
  return Array.from({ length: 8 }, (_, index) => {
    const number = index + 1;
    return {
      number,
      pageId: config[`PANCAKE_PAGE_${number}_ID`] ?? "",
      token: config[`PANCAKE_PAGE_${number}_TOKEN`] ?? "",
    };
  }).filter((page) => page.pageId && page.token);
}

export function database() {
  return (env as unknown as RuntimeEnv).DB;
}

export async function fetchConversations(page: PancakePage, lastConversationId?: string) {
  const url = new URL(`https://pages.fm/api/public_api/v2/pages/${encodeURIComponent(page.pageId)}/conversations`);
  url.searchParams.set("page_access_token", page.token);
  url.searchParams.set("page_size", "60");
  if (lastConversationId) url.searchParams.set("last_conversation_id", lastConversationId);
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => null) as AnyRecord | null;
  if (!response.ok || !payload || payload.success === false) {
    const message = typeof payload?.message === "string" ? payload.message : `Pancake returned ${response.status}`;
    throw new Error(message);
  }
  const candidates = [payload.conversations, payload.data, (payload.data as AnyRecord | undefined)?.conversations];
  const conversations = candidates.find(Array.isArray) as AnyRecord[] | undefined;
  return conversations ?? [];
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nested(record: AnyRecord, key: string) {
  const value = record[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

function tagNames(record: AnyRecord) {
  const raw = record.tags ?? record.tag_histories ?? nested(record, "customer").tags ?? [];
  if (!Array.isArray(raw)) return [];
  return raw.map((tag) => typeof tag === "string" ? tag : text((tag as AnyRecord)?.name) ?? text((tag as AnyRecord)?.tag_name)).filter(Boolean) as string[];
}

export function normalizeConversation(pageId: string, record: AnyRecord) {
  const customer = nested(record, "customer");
  const pageCustomer = nested(record, "page_customer");
  const tags = tagNames(record);
  const classified = classifyLead(tags);
  const assigned = record.assigned_users ?? record.assigned_user_ids ?? record.assignee_ids;
  const assignedAgentId = Array.isArray(assigned)
    ? text(typeof assigned[0] === "object" ? (assigned[0] as AnyRecord)?.id : assigned[0])
    : text(record.assigned_user_id ?? nested(record, "assigned_user").id);
  return {
    pageId,
    conversationId: text(record.id ?? record.conversation_id) ?? "",
    customerId: text(customer.id ?? customer.psid ?? pageCustomer.id ?? record.customer_id),
    customerName: text(customer.name ?? customer.full_name ?? pageCustomer.name ?? record.customer_name) ?? "Unknown customer",
    channel: text(record.type ?? record.channel ?? record.platform) ?? "unknown",
    stage: classified.stage,
    products: classified.products,
    locations: classified.locations,
    assignedAgentId,
    firstInboundAt: text(record.inserted_at ?? record.created_at ?? record.first_message_at),
    lastInteractionAt: text(record.updated_at ?? record.last_message_at ?? record.last_sent_at),
    soldAt: classified.stage === "sold" ? text(record.updated_at ?? record.last_message_at) : null,
    rawTags: classified.rawTags,
    hasConflict: classified.hasConflict,
  };
}
