import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const base = process.env.TEST_BASE_URL ?? "http://localhost:3400";
const client = new Client({ name: "basic-integration-test", version: "1.0.0" });
try {
  await client.connect(
    new StreamableHTTPClientTransport(new URL(base + "/mcp")),
  );
  const tools = await client.listTools();
  assert.deepEqual(tools.tools.map((t) => t.name).sort(), [
    "get_server",
    "get_setup_instructions",
    "search_servers",
  ]);
  const response: any = await client.callTool({
    name: "search_servers",
    arguments: { query: "Search repository issues" },
  });
  assert.ok(!response.isError);
  const search = JSON.parse(response.content[0].text);
  const web = await fetch(
    base + "/api/search?q=Search%20repository%20issues",
  ).then((r) => r.json());
  assert.deepEqual(
    search.results.map((r: any) => r.id),
    web.results.map((r: any) => r.id),
  );
  assert.ok(search.results.some((r: any) => r.id === "github"));
  const server: any = await client.callTool({
    name: "get_server",
    arguments: { id: "microsoft-learn" },
  });
  assert.equal(JSON.parse(server.content[0].text).id, "microsoft-learn");
  const setup: any = await client.callTool({
    name: "get_setup_instructions",
    arguments: {
      id: "microsoft-learn",
      client: "vscode",
      deploymentId: "remote-0",
    },
  });
  assert.equal(
    JSON.parse(JSON.parse(setup.content[0].text).configuration).servers[
      "microsoft-learn"
    ].url,
    "https://learn.microsoft.com/api/mcp",
  );
  assert.equal(
    (
      await fetch(base + "/mcp", {
        headers: { origin: "https://untrusted.example" },
        method: "POST",
        body: "{}",
      })
    ).status,
    403,
  );
  console.log(
    JSON.stringify({
      initialized: true,
      toolListing: true,
      toolCalls: 3,
      webMcpConsistency: true,
      originRejection: true,
    }),
  );
} finally {
  await client.close();
}
