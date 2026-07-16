import { env } from "cloudflare:workers";

type PancakeEnv = { PANCAKE_PAGE_ID?: string; PANCAKE_PAGE_ACCESS_TOKEN?: string };

export async function GET() {
  const config = env as unknown as PancakeEnv;
  return Response.json({
    configured: Boolean(config.PANCAKE_PAGE_ID && config.PANCAKE_PAGE_ACCESS_TOKEN),
    pageId: config.PANCAKE_PAGE_ID ?? null,
    tokenStored: Boolean(config.PANCAKE_PAGE_ACCESS_TOKEN),
  });
}

export async function POST() {
  const config = env as unknown as PancakeEnv;
  if (!config.PANCAKE_PAGE_ID || !config.PANCAKE_PAGE_ACCESS_TOKEN) {
    return Response.json({ ok: false, error: "Pancake page ID and page access token are not configured." }, { status: 400 });
  }
  const url = new URL(`https://pages.fm/api/public_api/v2/pages/${encodeURIComponent(config.PANCAKE_PAGE_ID)}/conversations`);
  url.searchParams.set("page_access_token", config.PANCAKE_PAGE_ACCESS_TOKEN);
  url.searchParams.set("page_size", "1");
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) return Response.json({ ok: false, error: `Pancake returned ${response.status}.` }, { status: 502 });
  const payload = await response.json() as Record<string, unknown>;
  return Response.json({ ok: true, pageId: config.PANCAKE_PAGE_ID, responseReceived: Boolean(payload) });
}

