import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("management dashboard includes required reporting controls", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /type="date"/);
  assert.match(page, /Export for Excel/);
  assert.match(page, /Executive management insights/);
  assert.match(page, /Page-adjusted expectation/);
  assert.match(page, /3%.*minimum/);
});

test("dashboard excludes comments from lead reporting", async () => {
  const route = await read("app/api/dashboard/route.ts");
  const leads = await read("app/api/dashboard/leads/route.ts");
  assert.match(route, /COALESCE\(channel, ''\) <> 'COMMENT'/);
  assert.match(leads, /COALESCE\(channel,''\)<>'COMMENT'/);
});

test("scheduled sync and overlap lock remain configured", async () => {
  const [worker, sync, wrangler] = await Promise.all([
    read("worker/index.ts"), read("lib/sync-pancake.ts"), read("wrangler.jsonc"),
  ]);
  assert.match(worker, /async scheduled/);
  assert.match(sync, /acquireLock/);
  assert.match(wrangler, /\*\/15 \* \* \* \*/);
});

test("exports are protected-compatible and filter-aware", async () => {
  const route = await read("app/api/dashboard/export/route.ts");
  assert.match(route, /Content-Disposition/);
  assert.match(route, /requestedStart/);
  assert.match(route, /selectedPage/);
  assert.match(route, /channel,''\)<>'COMMENT'/);
});
