import { configuredPages } from "../../../../lib/pancake";

export async function GET() {
  const configured = configuredPages();
  const pages = Array.from({ length: 8 }, (_, index) => configured.find((page) => page.number === index + 1) ?? { number: index + 1, pageId: "", token: "" });
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
        const payload = await response.json().catch(() => null) as { success?: boolean; message?: string } | null;
        const ok = response.ok && payload?.success !== false;
        return {
          number,
          pageId,
          ok,
          error: ok ? null : payload?.message ?? `Pancake returned ${response.status}`,
        };
      } catch {
        return { number, pageId, ok: false, error: "Connection failed" };
      }
    }),
  );

  const connected = results.filter((result) => result.ok).length;
  return Response.json({ ok: connected === pages.length, connected, total: pages.length, pages: results });
}
