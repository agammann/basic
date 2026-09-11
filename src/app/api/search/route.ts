import { searchServers } from "@/lib/search";
import { searchFromParams } from "@/lib/url";
import { boundedJson, rateLimit, validHostOrigin } from "@/lib/http";
export async function GET(req: Request) {
  if (req.url.length > 4096)
    return Response.json({ error: "URL too long" }, { status: 414 });
  if (!validHostOrigin(req))
    return Response.json({ error: "Host or origin rejected" }, { status: 403 });
  try {
    if (!(await rateLimit(req)))
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    return boundedJson(
      await searchServers(
        searchFromParams(Object.fromEntries(new URL(req.url).searchParams)),
      ),
    );
  } catch {
    return Response.json(
      { error: "Invalid search or unavailable catalog" },
      { status: 400 },
    );
  }
}
