import { createHash } from "node:crypto";
import { sql } from "./db";
import { config } from "./config";
export function validHostOrigin(req: Request) {
  const origin = new URL(config.APP_ORIGIN);
  const allowed = new Set([
    origin.host,
    ...(process.env.NODE_ENV !== "production"
      ? ["localhost:3400", "127.0.0.1:3400"]
      : []),
  ]);
  return (
    allowed.has(req.headers.get("host") ?? new URL(req.url).host) &&
    (!req.headers.has("origin") || req.headers.get("origin") === origin.origin)
  );
}
export async function rateLimit(req: Request) {
  const identity =
    process.env.TRUST_PROXY === "true"
      ? (req.headers.get("x-basic-client-ip") ?? "shared")
      : "shared";
  const key = createHash("sha256")
    .update(identity + "|" + new Date().toISOString().slice(0, 10))
    .digest("hex");
  const [r] =
    await sql`INSERT INTO rate_buckets(key,window_at,count) VALUES (${key},date_trunc('minute',now()),1) ON CONFLICT(key) DO UPDATE SET window_at=date_trunc('minute',now()),count=CASE WHEN rate_buckets.window_at=date_trunc('minute',now()) THEN rate_buckets.count+1 ELSE 1 END RETURNING count`;
  return r.count <= config.RATE_LIMIT_PER_MINUTE;
}
export async function readBoundedJson(
  req: Request,
  max = 32768,
  timeoutMs = config.REQUEST_BODY_TIMEOUT_MS,
) {
  if (Number(req.headers.get("content-length") ?? 0) > max)
    throw Error("body-too-large");
  if (!req.body) throw Error("body-required");
  const reader = req.body.getReader();
  let size = 0;
  const chunks = [];
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(Error("body-deadline"));
      void reader.cancel().catch(() => {});
    }, timeoutMs);
  });
  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw Error("body-too-large");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    clearTimeout(timer!);
    reader.releaseLock();
  }
}
export function boundedJson(value: unknown, max = 262144) {
  const text = JSON.stringify(value);
  if (Buffer.byteLength(text) > max)
    return Response.json(
      { error: "Response too large. Narrow the request." },
      { status: 413 },
    );
  return new Response(text, {
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}
