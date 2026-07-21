import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("management dashboard includes required reporting controls", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /type="date"/);
  assert.match(page, /today: "Today"/);
  assert.match(page, /Export for Excel/);
  assert.match(page, /Executive management insights/);
  assert.match(page, /Page-adjusted expectation/);
  assert.match(page, /3%.*minimum/);
});

test("today reporting uses the business UTC+8 calendar day", async () => {
  const [dashboard, leads, exportRoute] = await Promise.all([
    read("app/api/dashboard/route.ts"), read("app/api/dashboard/leads/route.ts"), read("app/api/dashboard/export/route.ts"),
  ]);
  for (const source of [dashboard, leads, exportRoute]) {
    assert.match(source, /range === "today"/);
    assert.match(source, /8 \* 60 \* 60 \* 1000/);
  }
});

test("sales are counted from newly detected SOLD transitions", async () => {
  const [migration, sync, dashboard] = await Promise.all([
    read("drizzle/0005_sale_transitions.sql"), read("lib/sync-pancake.ts"), read("app/api/dashboard/route.ts"),
  ]);
  assert.match(migration, /lead_stage_transition_event/);
  assert.match(migration, /legacy_sold_at/);
  assert.match(sync, /leads\.stage IS NOT 'sold'/);
  assert.match(dashboard, /sold_at >=/);
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

test("multi-platform foundation preserves Pancake while preparing Meta and TikTok", async () => {
  const [schema, migration, sync, dashboard, page] = await Promise.all([
    read("db/schema.ts"), read("drizzle/0004_multiplatform_foundation.sql"), read("lib/sync-pancake.ts"),
    read("app/api/dashboard/route.ts"), read("app/page.tsx"),
  ]);
  assert.match(schema, /platformAccounts/);
  assert.match(schema, /externalRecordId/);
  assert.match(migration, /UPDATE `leads` SET/);
  assert.match(sync, /'pancake', 'pancake'/);
  assert.match(dashboard, /selectedPlatform/);
  assert.match(page, /every connected messaging and lead platform/);
});
