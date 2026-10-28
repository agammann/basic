import { beforeEach, expect, it, vi } from "vitest";
import fs from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import { profileSchema } from "../src/lib/types";

// These are real SDK/schema/transport contracts with fixture SQL, not evidence
// of a live PostgreSQL connection or a third-party MCP server installation.
const { sql } = vi.hoisted(() => ({ sql: vi.fn() }));
vi.mock("../src/lib/db", () => ({ sql }));
import { createMcpServer } from "../src/lib/mcp";
import { POST, GET, DELETE } from "../src/app/mcp/route";

const profile = profileSchema.parse(
  JSON.parse(fs.readFileSync("curation/profiles/microsoft-learn.json", "utf8")),
);
function healthyDatabase(strings: TemplateStringsArray | string[]) {
  if (!("raw" in strings)) return [];
  const query = strings.join("?");
  if (query.startsWith("INSERT INTO rate_buckets")) return [{ count: 1 }];
  if (query.startsWith("SELECT p.data"))
    return [
      {
        data: profile,
        status: "active",
        registry_version: profile.version,
        rank: 1,
      },
    ];
  if (
    query.includes("FROM verification_runs") ||
    query.startsWith("SELECT v.*")
  )
    return [];
  throw Error("Unexpected fixture query");
}
beforeEach(() => {
  sql.mockReset();
  sql.mockImplementation(healthyDatabase);
});

async function withClient(check: (client: Client) => Promise<void>) {
  const server = createMcpServer();
  const client = new Client({ name: "basic-contract-test", version: "1.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    await check(client);
  } finally {
    await client.close();
    await server.close();
  }
}

function resultJson(result: unknown) {
  const parsed = z
    .object({
      isError: z.boolean().optional(),
      content: z.array(z.object({ type: z.literal("text"), text: z.string() })),
    })
    .parse(result);
  expect(parsed.isError).not.toBe(true);
  return JSON.parse(parsed.content[0].text);
}

it("initializes the SDK, lists read-only tools and exercises all three real handlers", async () => {
  await withClient(async (client) => {
    const listing = await client.listTools();
    expect(listing.tools.map((tool) => tool.name).sort()).toEqual([
      "get_server",
      "get_setup_instructions",
      "search_servers",
    ]);
    expect(
      listing.tools.every((tool) => tool.annotations?.readOnlyHint === true),
    ).toBe(true);
    const search = resultJson(
      await client.callTool({
        name: "search_servers",
        arguments: { query: "documentation" },
      }),
    );
    expect(search.results[0].id).toBe(profile.id);
    const detail = resultJson(
      await client.callTool({
        name: "get_server",
        arguments: { id: profile.id },
      }),
    );
    expect(detail.id).toBe(profile.id);
    const setup = resultJson(
      await client.callTool({
        name: "get_setup_instructions",
        arguments: {
          id: profile.id,
          client: "vscode",
          deploymentId: "remote-0",
        },
      }),
    );
    expect(JSON.parse(setup.configuration).servers[profile.id].url).toBe(
      "https://learn.microsoft.com/api/mcp",
    );
  });
});

it.each([
  { page: 0 },
  { query: "x".repeat(241) },
  { filters: { auth: "invented" } },
])(
  "rejects invalid search arguments through the SDK schema before SQL: %j",
  async (args) => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "search_servers",
        arguments: args,
      });
      expect(result.isError).toBe(true);
      expect(sql).not.toHaveBeenCalled();
    });
  },
);

it("keeps database failures generic and recovers on the next SDK call", async () => {
  await withClient(async (client) => {
    sql.mockRejectedValue(Error("postgresql://private-host/catalog secret"));
    const result = await client.callTool({
      name: "search_servers",
      arguments: {},
    });
    expect(result).toMatchObject({
      isError: true,
      content: [
        { type: "text", text: "Catalog request could not be completed." },
      ],
    });
    sql.mockImplementation(healthyDatabase);
    expect(
      resultJson(
        await client.callTool({ name: "search_servers", arguments: {} }),
      ).total,
    ).toBe(1);
  });
});

it("uses the actual Streamable HTTP SDK with the application route and fixture SQL", async () => {
  const client = new Client({
    name: "basic-http-contract-test",
    version: "1.0.0",
  });
  const transport = new StreamableHTTPClientTransport(
    new URL("http://localhost:3400/mcp"),
    {
      fetch: async (input, init) => {
        const req = new Request(input, init);
        if (req.method === "POST") return POST(req);
        if (req.method === "DELETE") return DELETE();
        return GET();
      },
    },
  );
  try {
    await client.connect(transport);
    expect((await client.listTools()).tools).toHaveLength(3);
    const result = await client.callTool({
      name: "search_servers",
      arguments: { query: "documentation" },
    });
    expect(resultJson(result).results[0].id).toBe(profile.id);
  } finally {
    await client.close();
  }
});
