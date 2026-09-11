import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { sql, closeDb } from "../src/lib/db";
import { profileSchema } from "../src/lib/types";
import { importRecords, syncRegistry } from "../src/lib/registry";
import { getSetup } from "../src/lib/setup";
import { log } from "../src/lib/config";
export async function migrate() {
  const conn = await sql.reserve();
  try {
    await conn`SELECT pg_advisory_lock(78143020)`;
    await conn`CREATE TABLE IF NOT EXISTS migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())`;
    for (const name of (await fs.readdir("migrations"))
      .filter((x) => x.endsWith(".sql"))
      .sort()) {
      const body = await fs.readFile("migrations/" + name, "utf8");
      const hash = createHash("sha256").update(body).digest("hex");
      const [old] =
        await conn`SELECT checksum FROM migrations WHERE name=${name}`;
      if (old && old.checksum !== hash)
        throw Error("applied-migration-changed");
      if (!old)
        await sql.begin(async (tx) => {
          await tx.unsafe(body);
          await tx`INSERT INTO migrations(name,checksum) VALUES (${name},${hash})`;
        });
    }
  } finally {
    await conn`SELECT pg_advisory_unlock(78143020)`;
    conn.release();
  }
}
export async function curate(dir = "curation/profiles") {
  const files = (await fs.readdir(dir)).filter((x) => x.endsWith(".json"));
  for (const file of files) {
    const p = profileSchema.parse(
      JSON.parse(await fs.readFile(dir + "/" + file, "utf8")),
    );
    const snapshot = JSON.parse(
      await fs.readFile(`curation/sources/${p.id}.registry.json`, "utf8"),
    );
    await sql.begin(async (tx) => {
      const existing =
        await tx`SELECT name FROM registry_records WHERE name=${p.registryName}`;
      if (dir === "curation/profiles" && !existing.length)
        await importRecords(tx, [snapshot]);
      await tx`INSERT INTO profiles(id,registry_name,published,data,search_vector) VALUES (${p.id},${p.registryName},${p.published},${tx.json(p)},setweight(to_tsvector('english',${p.name}),'A') || setweight(to_tsvector('english',${p.tasks.join(" ")}),'A') || setweight(to_tsvector('english',${p.tools.map((t) => t.name + " " + t.description).join(" ")}),'B') || setweight(to_tsvector('english',${p.description}),'C')) ON CONFLICT(id) DO UPDATE SET published=EXCLUDED.published,data=EXCLUDED.data,search_vector=EXCLUDED.search_vector`;
      for (const table of ["deployments", "tools", "claims", "setup_templates"])
        await tx`DELETE FROM ${tx(table)} WHERE profile_id=${p.id}`;
      for (const [table, values] of [
        ["deployments", p.deployments],
        ["tools", p.tools],
        ["claims", p.claims],
        [
          "setup_templates",
          p.deployments.flatMap((d) => [
            getSetup(p, "vscode", d.id),
            getSetup(p, "claude-code", d.id),
          ]),
        ],
      ] as const)
        for (const [i, value] of values.entries())
          await tx`INSERT INTO ${tx(table)}(key,profile_id,data) VALUES (${p.id + ":" + i},${p.id},${tx.json(value)})`;
    });
  }
  return { profiles: files.length };
}
export async function run(command: string) {
  if (command === "migrate") return migrate();
  if (command === "curate") return curate();
  if (command === "sync") return syncRegistry();
  if (command === "reconcile") return syncRegistry(true);
  if (command === "check") {
    const { runApprovedChecks } = await import("../src/lib/verify");
    return runApprovedChecks();
  }
  if (command === "stale") {
    const { getServer } = await import("../src/lib/search");
    const rows = await sql`SELECT id FROM profiles WHERE published`;
    return (await Promise.all(rows.map((r) => getServer(r.id)))).flatMap((p) =>
      p
        ? p.evidence
            .filter((e) => e.status === "stale" || e.status === "not-tested")
            .map((e) => ({
              id: p.id,
              deployment: e.deploymentId,
              status: e.status,
            }))
        : [],
    );
  }
  if (command === "fixtures") {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.ENABLE_FIXTURES !== "true" ||
      !process.env.DATABASE_URL ||
      new URL(process.env.DATABASE_URL).pathname !== "/basic_test"
    )
      throw Error("fixtures-require-explicit-disposable-basic_test-database");
    const fixture = JSON.parse(
      await fs.readFile("tests/fixtures/fixture-profile.json", "utf8"),
    );
    await sql`INSERT INTO profiles(id,registry_name,published,data,search_vector) VALUES (${fixture.id},'example.invalid/offline-fixture',false,${sql.json(fixture)},to_tsvector('english','fixture')) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,published=false`;
    return {
      message:
        "Loaded unpublished synthetic fixture in disposable basic_test database.",
    };
  }
  throw Error("Unknown command");
}
if (process.argv[1]?.endsWith("operator.ts")) {
  try {
    const result = await run(process.argv[2]);
    log("operator-complete", { command: process.argv[2] });
    if (result) console.log(JSON.stringify(result, null, 2));
  } catch {
    log("operator-failed", { command: process.argv[2] ?? "missing" });
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}
