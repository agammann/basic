import { sql } from "./db";
import {
  searchSchema,
  type Filters,
  type Profile,
  type Verification,
} from "./types";
import { evidenceFor } from "./evidence";
const synonyms: Record<string, string> = {
  programming: "code documentation",
  docs: "documentation",
  bugs: "issues",
  tickets: "issues",
  repository: "repositories",
  website: "web",
  websites: "web",
  tasks: "projects issues",
  project: "projects",
  restricted: "permissions",
  readonly: "read",
};
const stop = new Set(
  "find a an the for my agent agents me i need want to with using without no api key keys free paid remote local read only restricted credentials access search information about public please programming tool tools mcp server servers can you help looking am that lets allow allows do does it is would like".split(
    " ",
  ),
);
export function parseTask(query: string, filters: Filters, auto = true) {
  let q = query.toLowerCase();
  const applied = { ...filters };
  const inferred: string[] = [];
  if (auto) {
    if (
      /\b(without (an? )?api keys?|no api keys?)\b/.test(q) &&
      !applied.auth
    ) {
      applied.auth = "none";
      inferred.push("No API key");
    }
    if (/\bfree\b/.test(q) && !applied.pricing) {
      applied.pricing = "free";
      inferred.push("Free");
    }
    if (/\bremote\b/.test(q) && !applied.setup) {
      applied.setup = "remote";
      inferred.push("Remote");
    }
    if (/\blocal\b/.test(q) && !applied.setup) {
      applied.setup = "local";
      inferred.push("Local");
    }
    if (
      /\brestricted (credentials|read|access)\b/.test(q) &&
      applied.restrictedRead === undefined
    ) {
      applied.restrictedRead = true;
      inferred.push("Restricted read credentials");
    }
  }
  // Each meaningful concept must match; alternatives inside a concept are synonyms.
  const terms = [
    ...new Set(
      q
        .replace(/[^a-z0-9_-]+/g, " ")
        .split(" ")
        .filter((t) => t.length > 1 && !stop.has(t)),
    ),
  ];
  const groups = terms
    .slice(0, 20)
    .map((t) =>
      [t, ...(synonyms[t]?.split(" ") ?? [])]
        .map((x) => x.replace(/[^a-z0-9_]/g, ""))
        .filter(Boolean),
    );
  return {
    filters: applied,
    inferred,
    terms,
    tsquery: groups.map((g) => "(" + g.join(" | ") + ")").join(" & "),
  };
}
export function deploymentMatches(
  p: Profile,
  d: Profile["deployments"][number],
  filters: Filters,
  runs: Verification[],
) {
  const known = (value: string, required: string) =>
    value === required || (filters.includeUnknown && value === "unknown");
  return (
    (!filters.setup || d.kind === filters.setup) &&
    (!filters.auth || known(d.auth, filters.auth)) &&
    (!filters.pricing || known(d.pricing, filters.pricing)) &&
    (!filters.restrictedRead || known(d.restrictedRead, "yes")) &&
    (!filters.verification ||
      evidenceFor(d, p.version, runs).status === filters.verification)
  );
}
const evidenceColumns = [
  "id",
  "profile_id",
  "deployment_id",
  "target",
  "version",
  "started_at",
  "duration_ms",
  "outcome",
  "fingerprint",
  "findings",
];
async function latestEvidence(ids: string[]): Promise<Verification[]> {
  if (!ids.length) return [];
  return (await sql`SELECT v.* FROM profiles p CROSS JOIN LATERAL jsonb_array_elements(p.data->'deployments') d CROSS JOIN LATERAL (SELECT ${sql(evidenceColumns)} FROM verification_runs WHERE profile_id=p.id AND deployment_id=d->>'id' ORDER BY started_at DESC,id DESC LIMIT 1) v WHERE p.id IN ${sql(ids)}`) as unknown as Verification[];
}
function summaryEvidence(
  d: Profile["deployments"][number],
  version: string,
  runs: Verification[],
) {
  const { history: _history, ...evidence } = evidenceFor(d, version, runs);
  return { deploymentId: d.id, ...evidence };
}
export async function getServer(id: string, historyPage = 1) {
  if (!Number.isInteger(historyPage) || historyPage < 1 || historyPage > 10000)
    throw Error("invalid-history-page");
  const rows =
    await sql`SELECT p.data,r.status,r.version as registry_version FROM profiles p LEFT JOIN registry_records r ON r.name=p.registry_name WHERE p.id=${id} AND p.published AND COALESCE(r.status,'active')!='deleted'`;
  if (!rows[0]) return null;
  const history =
    (await sql`SELECT ${sql(evidenceColumns)} FROM verification_runs WHERE profile_id=${id} ORDER BY started_at DESC,id DESC LIMIT 21 OFFSET ${(historyPage - 1) * 20}`) as unknown as Verification[];
  const runs = history.slice(0, 20);
  const latest = await latestEvidence([id]);
  const p = rows[0].data as Profile;
  return {
    ...p,
    status: rows[0].status ?? "unknown",
    registryVersion: rows[0].registry_version,
    versionChanged: rows[0].registry_version !== p.version,
    metadataValidated: Boolean(rows[0].registry_version),
    history: { page: historyPage, limit: 20, hasMore: history.length > 20 },
    runs,
    evidence: p.deployments.map((d) => summaryEvidence(d, p.version, latest)),
  };
}
export async function searchServers(raw: unknown) {
  const input = searchSchema.parse(raw);
  const parsed = parseTask(input.query, input.filters, input.autoConstraints);
  const rows =
    await sql`SELECT p.data,r.status,r.version as registry_version,CASE WHEN ${parsed.tsquery}='' THEN 0 ELSE ts_rank_cd(p.search_vector,to_tsquery('english',${parsed.tsquery})) END as rank FROM profiles p LEFT JOIN registry_records r ON r.name=p.registry_name WHERE p.published AND COALESCE(r.status,'active')!='deleted' AND (${parsed.tsquery}='' OR p.search_vector @@ to_tsquery('english',${parsed.tsquery})) ORDER BY rank DESC, (p.data->>'collectedAt') DESC, p.id LIMIT 2000`;
  const ids = rows.map((r) => (r.data as Profile).id);
  const runs = await latestEvidence(ids);
  const all = rows.flatMap((row) => {
    const p = row.data as Profile;
    if (parsed.filters.category && p.category !== parsed.filters.category)
      return [];
    const history = runs.filter((r) => r.profile_id === p.id);
    const ds = p.deployments.filter((d) =>
      deploymentMatches(p, d, parsed.filters, history),
    );
    if (!ds.length) return [];
    const matchingTools = p.tools
      .filter((t) =>
        parsed.terms.some((term) =>
          (t.name + " " + t.description).toLowerCase().includes(term),
        ),
      )
      .slice(0, 3);
    const matchingTasks = p.tasks
      .filter((t) =>
        parsed.terms.some((term) => t.toLowerCase().includes(term)),
      )
      .slice(0, 3);
    return [
      {
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        status: row.status ?? "unknown",
        version: p.version,
        registryVersion: row.registry_version,
        versionChanged: row.registry_version !== p.version,
        rank: Number(row.rank),
        collectedAt: p.collectedAt,
        deployments: ds,
        tools: matchingTools,
        reasons: [
          ...matchingTasks.map((t) => "Matching task: " + t),
          ...matchingTools.map((t) => "Relevant documented tool: " + t.name),
          ...ds
            .slice(0, 1)
            .map((d) => `Requirement: ${d.kind}; authentication ${d.auth}`),
          ...(p.unknowns.length
            ? ["Missing information: " + p.unknowns[0]]
            : []),
        ],
        evidence: ds.map((d) => summaryEvidence(d, p.version, history)),
        sources: p.claims
          .map((c) => c.source)
          .filter((s, i, a) => a.findIndex((t) => t.url === s.url) === i),
      },
    ];
  });
  const freshness = (r: (typeof all)[number]) =>
    Math.max(
      Date.parse(r.collectedAt),
      ...r.evidence.map((e) =>
        e.latest ? Date.parse(e.latest.started_at) : 0,
      ),
    );
  all.sort(
    (a, b) =>
      b.rank - a.rank ||
      freshness(b) - freshness(a) ||
      a.id.localeCompare(b.id),
  );
  const start = (input.page - 1) * input.limit;
  return {
    query: input.query,
    filters: parsed.filters,
    inferred: parsed.inferred,
    total: all.length,
    page: input.page,
    limit: input.limit,
    results: all.slice(start, start + input.limit),
    truncated: rows.length === 2000,
  };
}
