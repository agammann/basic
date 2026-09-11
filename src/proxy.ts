import { NextResponse, type NextRequest } from "next/server";
import { validHostOrigin, rateLimit } from "./lib/http";
export async function proxy(req: NextRequest) {
  if (!validHostOrigin(req))
    return new NextResponse("Host or origin rejected", { status: 403 });
  if (req.url.length > 4096)
    return new NextResponse("URL too long", { status: 414 });
  try {
    if (!(await rateLimit(req)))
      return new NextResponse("Too many requests; try again in a minute.", {
        status: 429,
        headers: { "retry-after": "60" },
      });
  } catch {
    return new NextResponse("Catalog temporarily unavailable", { status: 503 });
  }
  return NextResponse.next();
}
export const config = { matcher: ["/", "/servers/:path*"] };
