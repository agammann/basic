import { searchServers } from "@/lib/search";
import { searchFromParams } from "@/lib/url";
import { searchSchema } from "@/lib/types";
import { boundedJson, rateLimit, validHostOrigin } from "@/lib/http";
export async function GET(req: Request) {
  if (req.url.length > 4096)
    return Response.json({ error: "URL too long" }, { status: 414 });
  if (!validHostOrigin(req))
    return Response.json({ error: "Host or origin rejected" }, { status: 403 });
  // Validate before either database-backed operation. An unavailable rate
  // limiter or catalog must not turn a valid request into a client error.
  let input: ReturnType<typeof searchSchema.parse>;
  try {
    input = searchSchema.parse(
      searchFromParams(Object.fromEntries(new URL(req.url).searchParams)),
    );
  } catch {
    return Response.json({ error: "Invalid search" }, { status: 400 });
  }
  try {
    if (!(await rateLimit(req)))
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    return boundedJson(await searchServers(input));
  } catch {
    return Response.json(
      { error: "Catalog unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
