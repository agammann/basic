import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp";
import { rateLimit, readBoundedJson, validHostOrigin } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (req.url.length > 4096)
    return Response.json({ error: "URL too long" }, { status: 414 });
  if (!validHostOrigin(req))
    return Response.json({ error: "Host or origin rejected" }, { status: 403 });
  try {
    if (!(await rateLimit(req)))
      return Response.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "retry-after": "60" } },
      );
    let body;
    try {
      body = await readBoundedJson(req);
    } catch {
      return Response.json(
        { error: "Invalid or oversized JSON request" },
        { status: 400 },
      );
    }
    const server = createMcpServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    try {
      await server.connect(transport);
      return await transport.handleRequest(req, { parsedBody: body });
    } finally {
      await server.close();
    }
  } catch {
    return Response.json({ error: "Catalog unavailable" }, { status: 503 });
  }
}
export function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
export function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
