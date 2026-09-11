import fs from "node:fs/promises";
import os from "node:os";
import { searchServers } from "../src/lib/search";
import { closeDb } from "../src/lib/db";
const results: Record<string, unknown> = {};
try {
  for (const split of ["development", "held-out"]) {
    const cases = JSON.parse(
      await fs.readFile(`evaluation/${split}.json`, "utf8"),
    );
    const rows = [];
    let answerable = 0,
      hits = 0,
      noMatch = 0,
      correctNoMatch = 0,
      violations = 0;
    for (const c of cases) {
      const r = await searchServers({ query: c.query, filters: c.filters });
      const top = r.results.slice(0, 3).map((x) => x.id);
      const pass = c.acceptable.length
        ? top.some((id) => c.acceptable.includes(id))
        : r.total === 0;
      if (c.acceptable.length) {
        answerable++;
        if (pass) hits++;
      } else {
        noMatch++;
        if (pass) correctNoMatch++;
      }
      for (const result of r.results)
        for (const d of result.deployments) {
          const f = r.filters;
          const equal = (a: string, b: string) =>
            a === b || (f.includeUnknown && a === "unknown");
          if (
            (f.auth && !equal(d.auth, f.auth)) ||
            (f.pricing && !equal(d.pricing, f.pricing)) ||
            (f.setup && d.kind !== f.setup) ||
            (f.category && result.category !== f.category) ||
            (f.verification &&
              result.evidence.find((e) => e.deploymentId === d.id)?.status !==
                f.verification) ||
            (f.restrictedRead && !equal(d.restrictedRead, "yes"))
          )
            violations++;
        }
      rows.push({
        query: c.query,
        acceptable: c.acceptable,
        appliedFilters: r.filters,
        top3: top,
        total: r.total,
        pass,
      });
    }
    results[split] = {
      queries: cases.length,
      answerable,
      top3Hits: hits,
      top3Relevance: answerable ? hits / answerable : 0,
      noMatchCases: noMatch,
      correctNoMatch,
      hardConstraintViolations: violations,
      rows,
    };
  }
  const times: number[] = [];
  const workload = [
    "documentation",
    "repository issues",
    "web research",
    "Notion",
    "Jira issues",
  ];
  for (let i = 0; i < 20; i++)
    await searchServers({ query: workload[i % workload.length] });
  for (let batch = 0; batch < 40; batch++)
    await Promise.all(
      Array.from({ length: 5 }, async (_, i) => {
        const start = performance.now();
        await searchServers({ query: workload[i] });
        times.push(performance.now() - start);
      }),
    );
  times.sort((a, b) => a - b);
  results.benchmark = {
    environment: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      cpu: os.cpus()[0]?.model,
      memoryGiB: Math.round(os.totalmem() / 1024 ** 3),
      node: process.version,
      database: "PostgreSQL 17.6 in Docker Desktop",
    },
    workload:
      "20 warmups, then 200 PostgreSQL-backed searches, concurrency 5, 30 profiles; direct shared search service, not HTTP",
    medianMs: times[Math.floor(times.length * 0.5)],
    p95Ms: times[Math.floor(times.length * 0.95)],
    maxMs: times.at(-1),
    productionCapacityClaim: false,
  };
  results.generatedAt = new Date().toISOString();
  const passed = ["development", "held-out"].every((key) => {
    const r = results[key] as any;
    return (
      r.top3Relevance >= 0.8 &&
      r.hardConstraintViolations === 0 &&
      r.noMatchCases === r.correctNoMatch
    );
  });
  results.passed = passed;
  if (!passed) process.exitCode = 1;
  await fs.mkdir("reports", { recursive: true });
  await fs.writeFile(
    "reports/search-evaluation.json",
    JSON.stringify(results, null, 2),
  );
  console.log(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(results).map(([k, v]) => [
          k,
          k === "benchmark"
            ? v
            : typeof v === "object"
              ? Object.fromEntries(
                  Object.entries(v as object).filter(([x]) => x !== "rows"),
                )
              : v,
        ]),
      ),
      null,
      2,
    ),
  );
} finally {
  await closeDb();
}
