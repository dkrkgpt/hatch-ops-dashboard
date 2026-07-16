import { env } from "cloudflare:workers";

type PancakeEnv = Record<string, string | undefined>;

function configuredPages() {
  const config = env as unknown as PancakeEnv;
  return Array.from({ length: 8 }, (_, index) => {
    const number = index + 1;
    return {
      number,
      pageId: config[`PANCAKE_PAGE_${number}_ID`],
      token: config[`PANCAKE_PAGE_${number}_TOKEN`],
    };
  });
}

export async function GET() {
  const pages = configuredPages();
  return Response.json({
    configured: pages.filter((page) => page.pageId && page.token).length,
    total: pages.length,
    pages: pages.map(({ number, pageId, token }) => ({
      number,
      pageId: pageId ?? null,
      tokenStored: Boolean(token),
    })),
  });
}

export async function POST() {
  const pages = configuredPages();
  const results = await Promise.all(
    pages.map(async ({ number, pageId, token }) => {
      if (!pageId || !token) {
        return { number, pageId: pageId ?? null, ok: false, error: "Not configured" };
      }

      const url = new URL(
        `https://pages.fm/api/public_api/v2/pages/${encodeURIComponent(pageId)}/conversations`,
      );
      url.searchParams.set("page_access_token", token);
      url.searchParams.set("page_size", "1");

      try {
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        return {
          number,
          pageId,
          ok: response.ok,
          error: response.ok ? null : `Pancake returned ${response.status}`,
        };
      } catch {
        return { number, pageId, ok: false, error: "Connection failed" };
      }
    }),
  );

  const connected = results.filter((result) => result.ok).length;
  return Response.json({ ok: connected === pages.length, connected, total: pages.length, pages: results });
}

