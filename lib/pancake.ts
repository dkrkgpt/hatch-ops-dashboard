import { env } from "cloudflare:workers";
import { classifyLead } from "./lead-stage";

type RuntimeEnv = Record<string, string | undefined> & { DB: D1Database };
type AnyRecord = Record<string, unknown>;

export type PancakePage = { number: number; pageId: string; token: string };
export type TagLookup = Map<string, string>;
export type UserLookup = Map<string, string>;

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

export async function fetchTags(page: PancakePage): Promise<TagLookup> {
  const url = new URL(`https://pages.fm/api/public_api/v1/pages/${encodeURIComponent(page.pageId)}/tags`);
  url.searchParams.set("page_access_token", page.token);
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => null) as AnyRecord | null;
  if (!response.ok || !payload || payload.success === false) {
    const message = typeof payload?.message === "string" ? payload.message : `Pancake tags returned ${response.status}`;
    throw new Error(message);
  }

  const candidates = [payload.tags, payload.data, (payload.data as AnyRecord | undefined)?.tags];
  const tags = candidates.find(Array.isArray) as unknown[] | undefined;
  const lookup: TagLookup = new Map();
  for (const raw of tags ?? []) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const tag = raw as AnyRecord;
    const id = text(tag.id ?? tag.tag_id);
    const name = text(tag.name ?? tag.tag_name ?? tag.text ?? tag.title);
    if (id && name) lookup.set(id, name);
  }
  return lookup;
}

export async function fetchUsers(page: PancakePage): Promise<UserLookup> {
  const url = new URL(`https://pages.fm/api/public_api/v1/pages/${encodeURIComponent(page.pageId)}/users`);
  url.searchParams.set("page_access_token", page.token);
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => null) as AnyRecord | null;
  if (!response.ok || !payload || payload.success === false) return new Map();

  const candidates = [payload.users, payload.data, (payload.data as AnyRecord | undefined)?.users];
  const users = candidates.find(Array.isArray) as unknown[] | undefined;
  const lookup: UserLookup = new Map();
  for (const raw of users ?? []) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const user = raw as AnyRecord;
    const id = text(user.id ?? user.user_id);
    const name = text(user.name ?? user.full_name ?? user.display_name ?? user.email);
    if (id && name) lookup.set(id, name);
  }
  return lookup;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nested(record: AnyRecord, key: string) {
  const value = record[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {};
}

export function tagNames(record: AnyRecord, lookup: TagLookup = new Map()) {
  const raw = record.tags ?? record.tag_ids ?? record.tag_histories ?? nested(record, "customer").tags ?? [];
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((tag) => {
    if (typeof tag === "string") return lookup.get(tag) ?? tag;
    if (!tag || typeof tag !== "object" || Array.isArray(tag)) return null;
    const item = tag as AnyRecord;
    const id = text(item.id ?? item.tag_id);
    return text(item.name ?? item.tag_name ?? item.text ?? item.title) ?? (id ? lookup.get(id) ?? id : null);
  }).filter(Boolean) as string[])];
}

export function normalizeConversation(pageId: string, record: AnyRecord, tagLookup: TagLookup = new Map(), userLookup: UserLookup = new Map()) {
  const customer = nested(record, "customer");
  const pageCustomer = nested(record, "page_customer");
  const tags = tagNames(record, tagLookup);
  const classified = classifyLead(tags);
  const assigned = record.assigned_users ?? record.assigned_user_ids ?? record.assignee_ids;
  const assignedRecord = Array.isArray(assigned) && assigned[0] && typeof assigned[0] === "object" ? assigned[0] as AnyRecord : nested(record, "assigned_user");
  const assignedAgentId = Array.isArray(assigned)
    ? text(typeof assigned[0] === "object" ? (assigned[0] as AnyRecord)?.id : assigned[0])
    : text(record.assigned_user_id ?? nested(record, "assigned_user").id);
  const embeddedAgentName = text(assignedRecord.name ?? assignedRecord.full_name ?? assignedRecord.display_name ?? assignedRecord.email);
  const channel = text(record.type ?? record.channel ?? record.platform) ?? "unknown";
  const stage = classified.stage === "unclassified" && channel.toUpperCase() !== "COMMENT" ? "engaged" : classified.stage;
  return {
    pageId,
    conversationId: text(record.id ?? record.conversation_id) ?? "",
    customerId: text(customer.id ?? customer.psid ?? pageCustomer.id ?? record.customer_id),
    customerName: text(customer.name ?? customer.full_name ?? pageCustomer.name ?? record.customer_name) ?? "Unknown customer",
    channel,
    stage,
    products: classified.products,
    locations: classified.locations,
    assignedAgentId,
    assignedAgentName: embeddedAgentName ?? (assignedAgentId ? userLookup.get(assignedAgentId) ?? null : null),
    firstInboundAt: text(record.inserted_at ?? record.created_at ?? record.first_message_at),
    lastInteractionAt: text(record.updated_at ?? record.last_message_at ?? record.last_sent_at),
    soldAt: stage === "sold" ? text(record.updated_at ?? record.last_message_at) : null,
    rawTags: classified.rawTags,
    hasConflict: classified.hasConflict,
  };
}
