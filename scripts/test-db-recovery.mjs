import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

// Destructive only to the GitHub job's disposable PostgreSQL service. Never
// accept a default container, arbitrary database URL, or a live installation.
assert.equal(
  process.env.GITHUB_ACTIONS,
  "true",
  "Requires a disposable GitHub Actions job",
);
const container = process.env.BASIC_DB_CONTAINER ?? "";
assert.match(
  container,
  /^[a-f0-9]{64}$/,
  "Requires the exact job service container ID",
);
const database = new URL(process.env.DATABASE_URL ?? "");
assert.equal(database.hostname, "localhost");
assert.equal(database.port, "5432");
assert.equal(database.pathname, "/basic");
assert.equal(database.username, "basic");
assert.equal(database.password, "basic_ci_only");
const base = new URL(process.env.APP_ORIGIN ?? "");
assert.equal(base.href, "http://localhost:3400/");
const docker = (...args) =>
  execFileSync("docker", args, { encoding: "utf8", timeout: 60000 });
const [owned] = JSON.parse(docker("inspect", container));
assert.equal(owned.Id, container);
assert.equal(owned.Config.Image, "postgres:17.6-alpine");
assert.equal(owned.State.Running, true);
const version = docker("exec", container, "postgres", "--version").trim();
const request = (path) =>
  fetch(new URL(path, base), { signal: AbortSignal.timeout(15000) });
const search = async () => {
  const response = await request("/api/search?q=GitHub");
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.ok(result.results.some(({ id }) => id === "github"));
  return result.results.map(({ id }) => id);
};
const before = await search();
let restartRequired = false;
let outage;
try {
  restartRequired = true;
  docker("stop", "--time", "10", container);
  assert.equal(
    JSON.parse(docker("inspect", container))[0].State.Running,
    false,
  );
  const valid = await request("/api/search?q=GitHub");
  assert.equal(valid.status, 503);
  assert.equal(valid.headers.get("cache-control"), "no-store");
  assert.deepEqual(await valid.json(), { error: "Catalog unavailable" });
  const invalid = await request("/api/search?page=-1");
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), { error: "Invalid search" });
  outage = {
    validSearchStatus: valid.status,
    invalidSearchStatus: invalid.status,
  };
} finally {
  if (restartRequired) docker("start", container);
}
let ready = false;
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    if ((await request("/ready")).ok) {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
assert.equal(
  ready,
  true,
  "The original application must recover without restart",
);
const after = await search();
assert.deepEqual(after, before, "Search results survive PostgreSQL stop/start");
const result = {
  testedAt: new Date().toISOString(),
  version,
  before,
  outage,
  after,
  applicationRestarted: false,
};
await mkdir("work", { recursive: true });
await writeFile(
  "work/http-recovery.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
