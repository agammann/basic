import Link from "next/link";
import { notFound } from "next/navigation";
import { getServer } from "@/lib/search";
import { clients, getSetup } from "@/lib/setup";
import { Copy } from "@/components/Copy";
export const dynamic = "force-dynamic";
export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ historyPage?: string }>;
}) {
  const requestedPage = Number((await searchParams).historyPage ?? 1);
  const p = await getServer(
    (await params).id,
    Number.isInteger(requestedPage) &&
      requestedPage > 0 &&
      requestedPage <= 10000
      ? requestedPage
      : 1,
  );
  if (!p) notFound();
  return (
    <div className="prose">
      <Link className="back" href="/">
        ← Search the catalog
      </Link>
      <div className="profiletop">
        <h1>{p.name}</h1>
        <p className="lead">{p.description}</p>
        <p className="secondary">
          Publisher namespace: {p.publisher} · Curated version {p.version} ·
          Sources collected {p.collectedAt.slice(0, 10)}
        </p>
        {p.status === "deprecated" && (
          <div className="notice">This registry entry is deprecated.</div>
        )}
        {p.versionChanged && (
          <div className="notice">
            The registry now reports version {p.registryVersion}. These curated
            claims apply to {p.version}; review the publisher before setup.
          </div>
        )}
        <a href={p.documentation}>Publisher documentation ↗</a>
        {p.metadataValidated && (
          <p className="source">
            Metadata validated against the published registry schema.
          </p>
        )}
        {p.repository && (
          <>
            {" "}
            · <a href={p.repository}>Repository ↗</a>
          </>
        )}
      </div>
      <section>
        <h2>Tasks and known tools</h2>
        <p>{p.tasks.join(" · ")}</p>
        {p.tools.length ? (
          p.tools.map((t) => (
            <div className="deployment" key={t.name}>
              <h3>
                <code>{t.name}</code>
              </h3>
              <p>{t.description}</p>
              <div className="source">
                {t.source.kind} · {t.source.collectedAt.slice(0, 10)} ·{" "}
                <a href={t.source.url}>Source</a>
                <br />
                {t.source.scope}
              </div>
            </div>
          ))
        ) : (
          <p>
            Individual tool definitions have not been curated. The publisher
            purpose is not proof of a specific workflow.
          </p>
        )}
      </section>
      <section>
        <h2>Deployment and setup</h2>
        <p>
          Review configuration before copying. Copying does not install anything
          or establish successful setup.
        </p>
        {p.deployments.map((d) => (
          <div className="deployment" key={d.id}>
            <h3>
              {d.kind === "remote" ? "Remote service" : "Local package"} ·{" "}
              {d.id}
            </h3>
            <p>
              <code>
                {d.endpoint ??
                  (d.package
                    ? d.package.name +
                      (d.package.version === "unknown"
                        ? " (version unknown)"
                        : "@" + d.package.version)
                    : "Package information unavailable")}
              </code>
            </p>
            <div className="deploygrid">
              <p>
                Transport: {d.transport}
                <br />
                Runtime: {d.runtime}
              </p>
              <p>
                Authentication: {d.auth}
                <br />
                Pricing: {d.pricing}
                <br />
                Restricted read credentials: {d.restrictedRead}
              </p>
            </div>
            {Object.entries(clients).map(([key, c]) => {
              const setup = getSetup(p, key as keyof typeof clients, d.id);
              return (
                <details key={key}>
                  <summary>Set up in {c.name}</summary>
                  <p>
                    {"missing" in setup ? setup.missing : setup.instructions}
                  </p>
                  {"configuration" in setup && setup.configuration && (
                    <div className="codebox">
                      <p>{setup.filename}</p>
                      <Copy text={setup.configuration} />
                      <pre>{setup.configuration}</pre>
                    </div>
                  )}
                  <p className="source">
                    {setup.validated} · Template {setup.templateRevision} ·{" "}
                    <a href={setup.clientSource}>Client documentation</a> ·{" "}
                    <a href={p.documentation}>Publisher setup</a>
                  </p>
                </details>
              );
            })}
            <p className="source">
              <a href={d.source.url}>Deployment source</a> ·{" "}
              {d.source.collectedAt.slice(0, 10)}
            </p>
          </div>
        ))}
      </section>
      <section>
        <h2>Authentication, permissions and pricing</h2>
        {p.claims.map((c, i) => (
          <div className="deployment" key={i}>
            <h3>{c.field}</h3>
            <p>{c.value}</p>
            <p className="source">
              {c.source.kind} · collected {c.source.collectedAt.slice(0, 10)} ·{" "}
              <a href={c.source.url}>Supporting source</a>
              <br />
              {c.source.scope}
            </p>
          </div>
        ))}
      </section>
      <section>
        <h2>Verification history</h2>
        <p>
          Initialization and tool listing check protocol connectivity. They do
          not test functional behavior or establish safety.
        </p>
        {p.evidence.map((e) => (
          <p key={e.deploymentId}>
            <strong>{e.deploymentId}: </strong>
            {e.label}
            {e.stale ? " · Evidence stale" : ""}
            {e.latest
              ? " · " + new Date(e.latest.started_at).toISOString()
              : ""}
          </p>
        ))}
        {p.runs.length ? (
          <div className="history">
            <table>
              <thead>
                <tr>
                  <th>Attempt</th>
                  <th>Target / version</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {p.runs.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {new Date(r.started_at).toISOString()}
                      <br />
                      {r.duration_ms} ms
                    </td>
                    <td>
                      {r.target}
                      <br />
                      {r.version}
                    </td>
                    <td>
                      {r.outcome}
                      <br />
                      {r.findings}
                      {r.fingerprint && (
                        <details>
                          <summary>Schema fingerprint</summary>
                          <code>{r.fingerprint}</code>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Not tested. No remote protocol attempts recorded.</p>
        )}
        <div className="pagination">
          {p.history.page > 1 && (
            <Link href={`?historyPage=${p.history.page - 1}`}>
              Newer attempts
            </Link>
          )}
          {p.history.hasMore && (
            <Link href={`?historyPage=${p.history.page + 1}`}>
              Older attempts
            </Link>
          )}
        </div>
      </section>
      <section>
        <h2>Unknowns and limitations</h2>
        <ul>
          {p.unknowns.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <p>
          Open-source licensing and hosted pricing are separate. Publisher
          namespace ownership is not vendor endorsement.
        </p>
      </section>
    </div>
  );
}
