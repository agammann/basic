import type { Profile } from "./types";
export const clients = {
  vscode: {
    name: "VS Code",
    source:
      "https://code.visualstudio.com/docs/agent-customization/mcp-servers",
  },
  "claude-code": {
    name: "Claude Code",
    source: "https://code.claude.com/docs/en/mcp",
  },
};
const localEnv: Record<string, string | undefined> = {
  context7: "CONTEXT7_API_KEY",
  "brave-search": "BRAVE_API_KEY",
  tavily: "TAVILY_API_KEY",
  firecrawl: "FIRECRAWL_API_KEY",
  "gitlab-docs-ozanmutlu": undefined,
  "better-notion": "NOTION_API_KEY",
};
const remoteHeader: Record<
  string,
  { name: string; prefix: string; env: string }
> = {
  context7: {
    name: "Authorization",
    prefix: "Bearer ",
    env: "CONTEXT7_API_KEY",
  },
  github: {
    name: "Authorization",
    prefix: "Bearer ",
    env: "GITHUB_PERSONAL_ACCESS_TOKEN",
  },
  "gitlab-jmrplens": { name: "PRIVATE-TOKEN", prefix: "", env: "GITLAB_TOKEN" },
  superdocs: {
    name: "Authorization",
    prefix: "Bearer ",
    env: "SUPERDOCS_API_KEY",
  },
};
export function getSetup(
  p: Profile,
  client: keyof typeof clients,
  deploymentId?: string,
) {
  const d = deploymentId
    ? p.deployments.find((x) => x.id === deploymentId)
    : p.deployments.length === 1
      ? p.deployments[0]
      : undefined;
  const base = {
    client,
    clientSource: clients[client].source,
    templateRevision: "2026-09-09",
    profileId: p.id,
    version: p.version,
    validated: "Syntax only; client integration not tested",
    publisherSetup: p.documentation,
  };
  if (!d)
    return {
      ...base,
      missing: "Choose a deployment.",
      choices: p.deployments.map((x) => x.id),
    };
  let entry: Record<string, unknown> | undefined;
  let secret: string | undefined;
  if (
    d.kind === "local" &&
    d.package?.registry === "npm" &&
    p.id in localEnv &&
    d.package.version !== "unknown"
  ) {
    secret = localEnv[p.id];
    entry = {
      command: "npx",
      args: ["-y", d.package.name + "@" + d.package.version],
    };
    if (client === "vscode") entry.type = "stdio";
    if (secret)
      entry.env = {
        [secret]:
          client === "vscode" ? "${input:credential}" : "${" + secret + "}",
      };
  } else if (
    d.transport === "streamable-http" &&
    d.endpoint &&
    !d.endpoint.includes("{") &&
    d.auth !== "unknown"
  ) {
    entry = { type: "http", url: d.endpoint };
    if (d.auth === "api-key") {
      const h = remoteHeader[p.id];
      if (!h) entry = undefined;
      else {
        secret = h.env;
        entry.headers = {
          [h.name]:
            h.prefix +
            (client === "vscode" ? "${input:credential}" : "${" + h.env + "}"),
        };
      }
    }
  }
  if (!entry)
    return {
      ...base,
      deploymentId: d.id,
      runtime: d.runtime,
      missing:
        "Reliable automatic configuration is unavailable for this deployment. Follow the publisher setup for exact runtime, arguments and credential placement. Basic does not guess these values.",
    };
  const configuration: Record<string, unknown> =
    client === "vscode"
      ? { servers: { [p.id]: entry } }
      : { mcpServers: { [p.id]: entry } };
  if (secret && client === "vscode")
    configuration.inputs = [
      {
        id: "credential",
        type: "promptString",
        description: "Enter your " + secret + " in your own MCP client",
        password: true,
      },
    ];
  return {
    ...base,
    deploymentId: d.id,
    runtime: d.runtime,
    authentication: d.auth,
    credentialPlaceholder: secret,
    instructions: secret
      ? client === "vscode"
        ? "Your client will ask for the credential. Basic never receives it."
        : "Set " +
          secret +
          " in your local environment before starting Claude Code. Review credential permissions."
      : d.auth === "oauth"
        ? "Your client opens publisher authentication. Review requested permissions."
        : "No API credential is included in the documented setup.",
    filename: client === "vscode" ? ".vscode/mcp.json" : ".mcp.json",
    configuration: JSON.stringify(configuration, null, 2),
  };
}
