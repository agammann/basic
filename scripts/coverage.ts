import fs from "node:fs/promises";
import { sql, closeDb } from "../src/lib/db";
try {
  const [counts] =
    await sql`SELECT (SELECT count(*)::int FROM profiles WHERE published) as profiles,(SELECT count(*)::int FROM registry_records) as accepted_registry_records,(SELECT count(*)::int FROM registry_quarantine) as quarantined_records,(SELECT count(*)::int FROM verification_runs) as historical_attempts`;
  const latest =
    await sql`SELECT DISTINCT ON(profile_id,deployment_id) profile_id,deployment_id,target,version,started_at,duration_ms,outcome,fingerprint,findings,jsonb_array_length(tools) as tool_count FROM verification_runs ORDER BY profile_id,deployment_id,started_at DESC,id DESC`;
  const sync =
    await sql`SELECT mode,started_at,finished_at,status,count FROM sync_runs WHERE status='complete' ORDER BY id DESC LIMIT 1`;
  const [catalog] =
    await sql`SELECT sum(jsonb_array_length(data->'deployments'))::int as deployment_options,sum(jsonb_array_length(data->'tools'))::int as curated_tool_summaries FROM profiles WHERE published`;
  const report = {
    generatedAt: new Date().toISOString(),
    ...counts,
    ...catalog,
    lastCompletedSync: sync[0] ?? null,
    latestPerDeployment: latest,
    checkedDeployments: latest.length,
    toolListsRetrieved: latest.filter((x) => x.outcome === "tools-listed")
      .length,
    authenticationRequired: latest.filter((x) => x.outcome === "auth-required")
      .length,
    thirdPartyToolsExecuted: 0,
    limitations: [
      "Protocol observations only; functional behavior and client installation were not tested.",
      "Fresh databases do not import this report as current evidence.",
      "Quarantined metadata was not accepted or published.",
    ],
  };
  await fs.mkdir("reports", { recursive: true });
  await fs.writeFile(
    "reports/verification-coverage.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      profiles: counts.profiles,
      checkedDeployments: latest.length,
      toolListsRetrieved: report.toolListsRetrieved,
      authenticationRequired: report.authenticationRequired,
    }),
  );
} finally {
  await closeDb();
}
