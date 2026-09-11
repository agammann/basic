import { sql } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const [r] =
      await sql`SELECT count(*)::int as count FROM profiles WHERE published`;
    return Response.json(
      { status: r.count ? "ready" : "empty", profiles: r.count },
      { status: r.count ? 200 : 503 },
    );
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
