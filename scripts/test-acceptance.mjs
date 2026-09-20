import fs from "node:fs/promises";
import assert from "node:assert/strict";

// Run against a Basic instance you control. No publisher tools are invoked.
const base = process.env.TEST_BASE_URL ?? "http://localhost:3400";
const request = (path) => fetch(new URL(path, base), { signal: AbortSignal.timeout(15000) });
const scenarios = [
  ...JSON.parse(await fs.readFile("evaluation/development.json", "utf8")),
  ...JSON.parse(await fs.readFile("evaluation/held-out.json", "utf8")),
  { query: "I need a tool to search GitHub issues", acceptable: ["github"] },
  { query: "Can you help me find an MCP server for GitHub issues?", acceptable: ["github"] },
  { query: "I am looking for tools that search GitHub issues", acceptable: ["github"] },
  { query: "Can you find a free remote tool for documentation without an API key", acceptable: ["microsoft-learn"] },
  { query: "I need a tool for quantum gardening", acceptable: [] },
];
const rows = [];
let violations = 0;
for (const scenario of scenarios) {
  const params = new URLSearchParams({ q: scenario.query });
  for (const [key, value] of Object.entries(scenario.filters ?? {})) params.set(key, String(value));
  const response = await request("/api/search?" + params);
  assert.equal(response.status, 200, `Search failed for ${scenario.query}. A private Sites URL requires authorized access.`);
  const result = await response.json();
  const top3 = result.results.slice(0, 3).map((profile) => profile.id);
  const passed = scenario.acceptable.length
    ? top3.some((id) => scenario.acceptable.includes(id))
    : result.total === 0;
  rows.push({ query: scenario.query, passed, top3 });
  for (const profile of result.results) {
    for (const deployment of profile.deployments) {
      const f = result.filters;
      const matches = (actual, required) => actual === required || (f.includeUnknown && actual === "unknown");
      if ((f.auth && !matches(deployment.auth, f.auth)) ||
          (f.pricing && !matches(deployment.pricing, f.pricing)) ||
          (f.setup && deployment.kind !== f.setup) ||
          (f.category && profile.category !== f.category) ||
          (f.restrictedRead && !matches(deployment.restrictedRead, "yes")) ||
          (f.verification && profile.evidence.find((e) => e.deploymentId === deployment.id)?.status !== f.verification)) violations++;
    }
  }
}
const ids = new Set();
const first = await request("/api/search").then((r) => r.json());
assert.equal(first.total, 30, "Update the reviewed acceptance scope deliberately if the catalog changes");
for (let page = 1; page <= Math.ceil(first.total / first.limit); page++) {
  const response = await request("/api/search?page=" + page);
  assert.equal(response.status, 200);
  const result = await response.json();
  for (const profile of result.results) {
    assert.ok(!ids.has(profile.id), "Duplicate profile across pages");
    ids.add(profile.id);
  }
}
assert.equal(ids.size, first.total);
for (const id of ids) assert.equal((await request("/servers/" + encodeURIComponent(id))).status, 200, id);
for (const route of ["/checks", "/privacy", "/connect"]) assert.equal((await request(route)).status, 200, route);
assert.equal((await request("/api/search?page=-1")).status, 400);
// Next.js may already have sent 200 before its streamed not-found UI renders.
const missing = await request("/servers/not-a-real-profile");
assert.ok([200, 404].includes(missing.status));
assert.match(await missing.text(), /not found|not available|unavailable/i);
const failures = rows.filter((row) => !row.passed);
console.log(JSON.stringify({ testedAt: new Date().toISOString(), base, searchCases: rows.length, passed: rows.length - failures.length, failures, hardConstraintViolations: violations, profilePages: ids.size, paginationComplete: true, infoRoutes: 3, missingProfileStatus: missing.status, invalidInput400: true }, null, 2));
assert.equal(failures.length, 0, "Search acceptance failures");
assert.equal(violations, 0, "A returned deployment violates a requested constraint");
