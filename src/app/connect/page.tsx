import { config } from "@/lib/config";
import { Copy } from "@/components/Copy";
export const dynamic = "force-dynamic";
export default function Connect() {
  const url = config.APP_ORIGIN + "/mcp";
  return (
    <div className="prose">
      <h1>Connect your agent to Basic</h1>
      <p className="lead">
        The same catalog, available through three read-only MCP tools.
      </p>
      <section>
        <h2>Streamable HTTP endpoint</h2>
        <p>
          <code>{url}</code>
        </p>
        <p>
          Basic requires no API key. Your client reads the catalog; it does not
          install tools, authenticate to publishers or run discovered tools.
        </p>
        {[
          [
            "VS Code",
            ".vscode/mcp.json",
            { servers: { basic: { type: "http", url } } },
            "https://code.visualstudio.com/docs/agent-customization/mcp-servers",
          ],
          [
            "Claude Code",
            ".mcp.json",
            { mcpServers: { basic: { type: "http", url } } },
            "https://code.claude.com/docs/en/mcp",
          ],
        ].map(([name, file, configuration, source]) => (
          <div className="deployment" key={String(name)}>
            <h3>{String(name)}</h3>
            <p>{String(file)}</p>
            <div className="codebox">
              <Copy text={JSON.stringify(configuration, null, 2)} />
              <pre>{JSON.stringify(configuration, null, 2)}</pre>
            </div>
            <p className="source">
              <a href={String(source)}>Official setup documentation</a> ·
              Template revision 2026-09-09 · Syntax validated; installation in
              this client not tested.
            </p>
          </div>
        ))}
      </section>
      <section>
        <h2>Available tools</h2>
        <ul>
          <li>
            <code>search_servers</code> — query, practical filters and
            pagination.
          </li>
          <li>
            <code>get_server</code> — a profile by stable ID, including sources
            and unknowns.
          </li>
          <li>
            <code>get_setup_instructions</code> — setup for a supported client
            and deployment, or explicit missing information.
          </li>
        </ul>
        <p>
          Example task: “Use Basic to find programming documentation tools and
          explain the requirements and evidence.”
        </p>
      </section>
    </div>
  );
}
