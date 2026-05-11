import { ApifyClient } from "apify-client";

function getApifyClient() {
  if (!process.env.APIFY_API_TOKEN) {
    throw new Error("Missing APIFY_API_TOKEN");
  }

  return new ApifyClient({ token: process.env.APIFY_API_TOKEN });
}

export async function runApifyActor({
  actorId,
  input = {},
  fetchResults = true,
  limit,
  testMode = false,
  maxLeads = 10,
}) {
  if (!actorId || typeof actorId !== "string") {
    throw new Error("actorId is required");
  }

  const parsedMaxLeads = Number(maxLeads);
  const safeMaxLeads = Number.isFinite(parsedMaxLeads)
    ? Math.max(1, Math.min(parsedMaxLeads, 10))
    : 10;

  const preparedInput = { ...input };
  if (testMode) {
    preparedInput.fetch_count = Math.min(
      safeMaxLeads,
      Number(preparedInput.fetch_count) || safeMaxLeads
    );
  }

  const client = getApifyClient();
  const run = await client.actor(actorId).call(preparedInput);

  if (!fetchResults || !run?.defaultDatasetId) {
    return { run, items: [] };
  }

  const effectiveLimit = testMode
    ? Math.min(safeMaxLeads, Number(limit) || safeMaxLeads)
    : limit;

  const { items } = await client
    .dataset(run.defaultDatasetId)
    .listItems(effectiveLimit ? { limit: effectiveLimit } : undefined);

  return { run, items };
}
