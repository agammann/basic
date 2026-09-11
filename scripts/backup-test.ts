import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
const target = "basic_restore_test_" + Date.now();
if (!/^basic_restore_test_\d+$/.test(target))
  throw Error("unsafe-restore-target");
const exec = (args: string[]) =>
  execFileSync("docker", ["exec", "basic-db-1", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
const counts = (db: string) =>
  exec([
    "psql",
    "-U",
    "basic",
    "-d",
    db,
    "-At",
    "-c",
    "SELECT 'profiles:'||count(*) FROM profiles UNION ALL SELECT 'registry:'||count(*) FROM registry_records UNION ALL SELECT 'verification:'||count(*) FROM verification_runs UNION ALL SELECT 'claims:'||count(*) FROM claims ORDER BY 1",
  ]);
let created = false;
try {
  exec([
    "pg_dump",
    "-U",
    "basic",
    "-d",
    "basic",
    "--format=custom",
    "--no-owner",
    "--no-acl",
    "--file=/tmp/basic-restore-test.dump",
  ]);
  const expected = counts("basic");
  exec(["createdb", "-U", "basic", target]);
  created = true;
  exec([
    "pg_restore",
    "-U",
    "basic",
    "--no-owner",
    "--no-acl",
    "--exit-on-error",
    "-d",
    target,
    "/tmp/basic-restore-test.dump",
  ]);
  const actual = counts(target);
  if (actual !== expected) throw Error("restored-row-count-mismatch");
  const search = exec([
    "psql",
    "-U",
    "basic",
    "-d",
    target,
    "-At",
    "-c",
    "SELECT count(*) FROM profiles WHERE search_vector @@ plainto_tsquery('english','documentation')",
  ]);
  if (Number(search.trim()) < 1) throw Error("restored-search-failed");
  await fs.mkdir("reports", { recursive: true });
  const report = {
    timestamp: new Date().toISOString(),
    database: "PostgreSQL 17.6 in Docker",
    source: "basic",
    disposableTarget: target,
    counts: actual.trim().split("\n"),
    searchCount: Number(search.trim()),
    passed: true,
    limitation:
      "Local dump/restore test; not an off-host disaster recovery drill.",
  };
  await fs.writeFile(
    "reports/backup-restore.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (created) exec(["dropdb", "-U", "basic", target]);
  exec(["rm", "-f", "/tmp/basic-restore-test.dump"]);
}
