export const STAGE_PRIORITY = ["sold", "lost", "buy_later", "form_pending", "hot_lead", "engaged"] as const;
export type LeadStage = typeof STAGE_PRIORITY[number] | "unclassified";

const productPrefix = "P_";
const locationPrefixes = ["LOC_", "LOC ", "LOC-"];

export function classifyLead(rawTags: string[]) {
  const tags = rawTags.map((tag) => tag.trim().toUpperCase());
  const has = (...names: string[]) => names.some((name) => tags.includes(name));
  const products = tags.filter((tag) => tag.startsWith(productPrefix));
  const locations = tags.filter((tag) => locationPrefixes.some((prefix) => tag.startsWith(prefix)));
  const candidates: LeadStage[] = [];

  if (has("SOLD", "STG_SOLD")) candidates.push("sold");
  if (has("LOST", "STG_LOST")) candidates.push("lost");
  if (has("RESERVATION", "BUY LATER", "STG_BUY_LATER")) candidates.push("buy_later");
  if (has("FORM_PENDING", "STG_FORM_PENDING")) candidates.push("form_pending");
  if (has("HOT LEAD", "HOT_LEAD", "STG_HOT")) candidates.push("hot_lead");
  if (products.length || locations.length) candidates.push("engaged");

  const stage = STAGE_PRIORITY.find((item) => candidates.includes(item)) ?? "unclassified";
  const activeStageCount = new Set(candidates.filter((item) => item !== "engaged" || candidates.length === 1)).size;
  return { stage, products, locations, hasConflict: activeStageCount > 1, rawTags: tags };
}

