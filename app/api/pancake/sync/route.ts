import { configuredPages, database } from "../../../../lib/pancake";
import { runPancakeSync } from "../../../../lib/sync-pancake";

export async function POST() {
  const result = await runPancakeSync(database(), configuredPages(), "manual");
  return Response.json(result, { status: result.busy ? 409 : 200 });
}
