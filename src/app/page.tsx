import Link from "next/link";
import { searchServers } from "@/lib/search";
import { searchFromParams } from "@/lib/url";
export const dynamic = "force-dynamic";
const examples = [
  "Find programming documentation",
  "Search public websites without an API key",
  "Search repository issues",
  "Read project tasks using restricted credentials",
];
const options = {
  category: ["documentation", "repositories", "research", "projects"],
  setup: ["local", "remote"],
  auth: ["none", "api-key", "oauth"],
  pricing: ["free", "freemium", "paid"],
  verification: [
    "tools-listed",
    "initialized",
    "auth-required",
    "failed",
    "not-tested",
    "stale",
  ],
};
const labels = {
  category: "Category",
  setup: "Setup",
  auth: "Authentication",
  pricing: "Pricing",
  verification: "Evidence",
};
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  let result;
  try {
    result = await searchServers(searchFromParams(params));
  } catch {
    return (
      <div className="error">
        <h1>Search is unavailable</h1>
        <p>
          The database may be unavailable, or the search parameters are invalid.
          The catalog has not been replaced with sample results.
        </p>
        <Link href="/">Reset search</Link>
      </div>
    );
  }
  const f = result.filters;
  const q = result.query;
  return (
    <>
      <h1>Find the right tools for your agent.</h1>
      <p className="lead">
        Search MCP servers, understand setup, and inspect the evidence.
      </p>
      <form action="/" id="search">
        <div className="searchbar">
          <input
            name="q"
            aria-label="Describe your task"
            placeholder="What do you want your agent to do?"
            maxLength={240}
            defaultValue={q}
          />
          <button className="primary" type="submit">
            Search
          </button>
        </div>
        <div className="examples">
          {examples.map((x) => (
            <Link key={x} href={"/?q=" + encodeURIComponent(x)}>
              {x}
            </Link>
          ))}
        </div>
        <div className="workspace">
          <aside className="filters" aria-label="Search filters">
            <h2>Filters</h2>
            {Object.entries(options).map(([key, values]) => (
              <label className="filter" key={key}>
                {labels[key as keyof typeof labels]}
                <select
                  aria-label={labels[key as keyof typeof labels]}
                  name={key}
                  defaultValue={f[key as keyof typeof options] ?? ""}
                >
                  <option value="">
                    Any {labels[key as keyof typeof labels].toLowerCase()}
                  </option>
                  {values.map((v) => (
                    <option value={v} key={v}>
                      {v === "none"
                        ? "No authentication"
                        : v.replaceAll("-", " ")}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label className="check">
              <input
                type="checkbox"
                name="restrictedRead"
                value="true"
                defaultChecked={f.restrictedRead}
              />
              Restricted read credentials documented
            </label>
            <label className="check">
              <input
                type="checkbox"
                name="includeUnknown"
                value="true"
                defaultChecked={f.includeUnknown}
              />
              Include unknown requirements
            </label>
            <label className="check">
              <input
                type="checkbox"
                name="auto"
                value="off"
                defaultChecked={params.auto === "off"}
              />
              Turn off inferred filters
            </label>
            <button className="filterbutton" type="submit">
              Apply filters
            </button>
            <Link
              className="filterreset"
              href={"/?q=" + encodeURIComponent(q) + "&auto=off"}
            >
              Clear filters
            </Link>
          </aside>
          <section aria-label="Search results">
            {Object.entries(f).some(
              ([k, v]) => v && k !== "includeUnknown",
            ) && (
              <div className="applied">
                Applied requirements:{" "}
                {Object.entries(f)
                  .filter(([k, v]) => v && k !== "includeUnknown")
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")}
                . Edit them in Filters.
                {f.includeUnknown ? " Unknown values are also included." : ""}
              </div>
            )}
            <div className="resultbar">
              <strong>
                {result.total} {result.total === 1 ? "result" : "results"}
              </strong>
              <span>Relevance, then evidence date</span>
            </div>
            {result.truncated && (
              <p className="notice">
                Showing matches from the first 2,000 relevant profiles. Narrow
                your task to search a smaller candidate set.
              </p>
            )}
            {result.results.length ? (
              result.results.map((r) => (
                <article className="result" key={r.id}>
                  <div className="resulttitle">
                    <h2>
                      <Link href={"/servers/" + r.id}>{r.name}</Link>
                    </h2>
                    <Link
                      href={"/servers/" + r.id}
                      aria-label={"View " + r.name + " profile"}
                    >
                      View profile →
                    </Link>
                  </div>
                  <p className="description">{r.description}</p>
                  {r.status === "deprecated" && (
                    <span className="badge warning">Deprecated</span>
                  )}
                  {r.versionChanged && (
                    <p className="secondary">
                      New registry version available; curated claims apply to{" "}
                      {r.version}.
                    </p>
                  )}
                  <div className="facts">
                    <div>
                      <strong>Matching facts</strong>
                      {r.reasons
                        .filter(
                          (x) =>
                            x.startsWith("Matching") ||
                            x.startsWith("Relevant"),
                        )
                        .slice(0, 3)
                        .map((x) => (
                          <p key={x}>
                            {x
                              .replace("Matching task: ", "")
                              .replace("Relevant documented tool: ", "")}
                          </p>
                        ))}
                      {!q && <p>{r.category}</p>}
                      {q &&
                        !r.reasons.some(
                          (x) =>
                            x.startsWith("Matching") ||
                            x.startsWith("Relevant"),
                        ) && <p>Matches indexed name or description</p>}
                    </div>
                    <div>
                      <strong>Setup requirements</strong>
                      {r.deployments.slice(0, 2).map((d) => (
                        <p key={d.id}>
                          {d.kind} · {d.transport}
                          <br />
                          Authentication: {d.auth}
                          <br />
                          Pricing: {d.pricing}
                        </p>
                      ))}
                    </div>
                    <div>
                      <strong>Evidence</strong>
                      {r.evidence.slice(0, 2).map((e) => (
                        <div key={e.deploymentId}>
                          <span
                            className={
                              "badge " +
                              (e.status === "failed" ? "warning" : "")
                            }
                          >
                            {e.label}
                          </span>
                          {e.stale && (
                            <span className="badge warning">
                              Evidence stale
                            </span>
                          )}
                        </div>
                      ))}
                      <p>Sources collected {r.collectedAt.slice(0, 10)}</p>
                      <p className="secondary">
                        Functional behavior not tested
                      </p>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty">
                <h2>No suitable matches</h2>
                <p>
                  Try a more specific task, edit your requirements, or
                  explicitly include unknown requirements.
                </p>
                <Link href="/">Browse the catalog</Link>
              </div>
            )}
            <div className="pagination">
              {result.page > 1 && (
                <Link
                  href={
                    "/?" +
                    new URLSearchParams({
                      ...Object.fromEntries(
                        Object.entries(params).filter(
                          (x): x is [string, string] =>
                            typeof x[1] === "string",
                        ),
                      ),
                      page: String(result.page - 1),
                    }).toString()
                  }
                >
                  Previous
                </Link>
              )}
              {result.page * result.limit < result.total && (
                <Link
                  href={
                    "/?" +
                    new URLSearchParams({
                      ...Object.fromEntries(
                        Object.entries(params).filter(
                          (x): x is [string, string] =>
                            typeof x[1] === "string",
                        ),
                      ),
                      page: String(result.page + 1),
                    }).toString()
                  }
                >
                  Next
                </Link>
              )}
            </div>
          </section>
        </div>
      </form>
    </>
  );
}
