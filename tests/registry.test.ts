import { beforeAll, afterAll, it, expect } from "vitest";
import fs from "node:fs";
// This test process uses a separate database. Never point it at production.
const { sql, closeDb } = await import("../src/lib/db");
const { migrate, curate } = await import("../scripts/operator");
const { importRecords, syncRegistry, validateRecord } =
  await import("../src/lib/registry");
const original = JSON.parse(
  fs.readFileSync("curation/sources/microsoft-learn.registry.json", "utf8"),
);
beforeAll(async () => {
  if (!new URL(process.env.DATABASE_URL!).pathname.endsWith("/basic_test"))
    throw Error("Requires disposable basic_test database");
  await migrate();
  await sql`TRUNCATE registry_records,server_versions,registry_quarantine,profiles,deployments,tools,claims,setup_templates,verification_runs,sync_runs,sync_state,rate_buckets RESTART IDENTITY CASCADE`;
});
afterAll(closeDb);
it("validates real current schema and rejects invented records", async () => {
  await expect(validateRecord(original)).resolves.toBeTruthy();
  await expect(
    validateRecord({ server: { name: "invented" } }),
  ).rejects.toThrow();
});
it("normalizes an empty optional repository without mutating the raw source", async () => {
  const r = JSON.parse(
    fs.readFileSync("curation/sources/notion.registry.json", "utf8"),
  );
  const n = await validateRecord(r);
  expect(n.server.repository).toBeUndefined();
  expect(r.server.repository).toEqual({});
});
it("imports idempotently and never publishes automatically", async () => {
  await sql.begin((tx) =>
    importRecords(tx, [structuredClone(original), structuredClone(original)]),
  );
  expect(
    (await sql`SELECT count(*)::int AS n FROM registry_records`)[0].n,
  ).toBe(1);
  expect((await sql`SELECT count(*)::int AS n FROM server_versions`)[0].n).toBe(
    1,
  );
  expect((await sql`SELECT count(*)::int AS n FROM profiles`)[0].n).toBe(0);
});
it("retains catalog and committed cursor across outage, then resumes", async () => {
  let calls = 0;
  await expect(
    syncRegistry(false, async () => {
      calls++;
      if (calls === 2) throw Error("offline-fixture-outage");
      return {
        servers: [structuredClone(original)],
        metadata: { nextCursor: "page-two" },
      };
    }),
  ).rejects.toThrow("offline-fixture-outage");
  expect(
    (await sql`SELECT value FROM sync_state WHERE key='incremental-pending'`)[0]
      .value.cursor,
  ).toBe("page-two");
  expect(
    (await sql`SELECT count(*)::int AS n FROM registry_records`)[0].n,
  ).toBe(1);
  expect(
    await sql`SELECT * FROM sync_state WHERE key='last-success'`,
  ).toHaveLength(0);
  await syncRegistry(false, async (url) => {
    expect(new URL(url).searchParams.get("cursor")).toBe("page-two");
    return { servers: [], metadata: {} };
  });
  expect(
    await sql`SELECT * FROM sync_state WHERE key='last-success'`,
  ).toHaveLength(1);
  expect(
    await sql`SELECT * FROM sync_state WHERE key='incremental-pending'`,
  ).toHaveLength(0);
});
it("curation survives lifecycle changes and deleted records leave discovery", async () => {
  await curate();
  const { getServer, searchServers } = await import("../src/lib/search");
  const before = await getServer("microsoft-learn");
  const deprecated = structuredClone(original);
  deprecated._meta["io.modelcontextprotocol.registry/official"].status =
    "deprecated";
  await sql.begin((tx) => importRecords(tx, [deprecated]));
  expect((await getServer("microsoft-learn"))?.status).toBe("deprecated");
  expect((await getServer("microsoft-learn"))?.claims).toEqual(before?.claims);
  const deleted = structuredClone(original);
  deleted._meta["io.modelcontextprotocol.registry/official"].status = "deleted";
  await sql.begin((tx) => importRecords(tx, [deleted]));
  expect(await getServer("microsoft-learn")).toBeNull();
  expect(
    (await searchServers({ query: "Microsoft Learn" })).results.some(
      (r) => r.id === "microsoft-learn",
    ),
  ).toBe(false);
});
it("failed page transaction cannot advance the checkpoint", async () => {
  await sql`DELETE FROM sync_state WHERE key='incremental-pending'`;
  await sql.unsafe(
    "CREATE FUNCTION reject_test_import() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated storage failure'; END $$",
  );
  await sql.unsafe(
    "CREATE TRIGGER reject_test_import BEFORE INSERT OR UPDATE ON registry_records FOR EACH ROW EXECUTE FUNCTION reject_test_import()",
  );
  try {
    await expect(
      syncRegistry(false, async () => ({
        servers: [structuredClone(original)],
        metadata: { nextCursor: "bad-page" },
      })),
    ).rejects.toThrow();
    expect(
      await sql`SELECT * FROM sync_state WHERE key='incremental-pending'`,
    ).toHaveLength(0);
  } finally {
    await sql.unsafe("DROP TRIGGER reject_test_import ON registry_records");
    await sql.unsafe("DROP FUNCTION reject_test_import()");
  }
});
it("quarantines invalid metadata atomically without publishing it", async () => {
  await syncRegistry(false, async () => ({
    servers: [{ server: { name: "invalid" } }],
    metadata: {},
  }));
  expect(
    (await sql`SELECT count(*)::int as n FROM registry_quarantine`)[0].n,
  ).toBeGreaterThan(0);
  expect(
    await sql`SELECT * FROM registry_records WHERE name='invalid'`,
  ).toHaveLength(0);
});
it("large historical schemas cannot poison bounded catalog summaries", async () => {
  await sql.begin((tx) => importRecords(tx, [structuredClone(original)]));
  const { getServer, searchServers } = await import("../src/lib/search");
  const p = (await getServer("microsoft-learn"))!;
  const d = p.deployments[0];
  const large = [
    {
      name: "fixture-tool",
      description: "x".repeat(300000),
      inputSchema: { type: "object" },
    },
  ];
  await sql`INSERT INTO verification_runs(profile_id,deployment_id,target,version,started_at,duration_ms,outcome,findings,tools) SELECT ${p.id},${d.id},${d.endpoint!},${p.version},now()-n*interval '1 minute',1,'tools-listed','Synthetic test observation',${sql.json(large)} FROM generate_series(1,80) n`;
  const result = await searchServers({ query: "Microsoft Learn", limit: 1 });
  expect(result.results[0].evidence[0].status).toBe("tools-listed");
  expect(result.results[0].evidence[0]).not.toHaveProperty("history");
  expect(result.results[0].evidence[0].latest).not.toHaveProperty("tools");
  expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(50000);
  const detail = (await getServer(p.id))!;
  expect(detail.runs).toHaveLength(20);
  expect(detail.history.hasMore).toBe(true);
  expect(detail.runs[0]).not.toHaveProperty("tools");
  expect(Buffer.byteLength(JSON.stringify(detail))).toBeLessThan(50000);
  expect((await getServer(p.id, 2))!.runs[0].id).not.toBe(detail.runs[0].id);
  expect(
    (
      await sql`SELECT count(*)::int as n FROM verification_runs WHERE profile_id=${p.id}`
    )[0].n,
  ).toBe(80);
});
