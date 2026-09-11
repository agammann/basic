import { config } from "@/lib/config";
export const dynamic = "force-dynamic";
export default function Checks() {
  return (
    <div className="prose">
      <h1>How checks work</h1>
      <p className="lead">
        Evidence describes a specific observation, at a specific time.
      </p>
      <section>
        <h2>What the labels mean</h2>
        <ul>
          <li>
            <strong>Metadata validated:</strong> the imported record passed its
            published registry JSON Schema. This checks its structure.
          </li>
          <li>
            <strong>MCP initialization passed:</strong> the approved endpoint
            completed the protocol handshake.
          </li>
          <li>
            <strong>Tool list retrieved:</strong> the endpoint returned tool
            definitions. No tools were executed.
          </li>
          <li>
            <strong>Authentication required:</strong> the endpoint requested
            credentials. Basic does not hold or supply them.
          </li>
          <li>
            <strong>Check failed:</strong> a connection, policy or protocol
            failure occurred.
          </li>
          <li>
            <strong>Not tested:</strong> no applicable check exists for this
            deployment and version.
          </li>
          <li>
            <strong>Evidence stale:</strong> the latest applicable attempt is
            older than {config.EVIDENCE_FRESH_DAYS} days.
          </li>
        </ul>
      </section>
      <section>
        <h2>The limits of these checks</h2>
        <p>
          A reachable server may still have broken tools, excessive permissions
          or unsafe behavior. Basic does not certify safety or prove functional
          capability. A newer failure remains visible even when a past attempt
          succeeded. Changed endpoints and versions do not inherit earlier
          observations.
        </p>
        <p>
          Registry records and publisher documentation can lag each other.
          Profiles show the scope and collection date for significant claims. An
          unknown requirement never satisfies a hard filter unless you choose to
          include unknowns.
        </p>
      </section>
      <section>
        <h2>Controlled verification</h2>
        <p>
          Only an operator can approve exact HTTPS destinations. Checks validate
          public DNS answers, pin the TLS connection to the approved public
          address, reject redirects, and limit time, bytes and tool-list pages.
          Registry imports never authorize a check. The public website and
          Basic’s MCP tools only read the local catalog.
        </p>
        <p>
          Third-party descriptions and schemas are untrusted data. Basic does
          not execute discovered packages or third-party tools.
        </p>
      </section>
    </div>
  );
}
