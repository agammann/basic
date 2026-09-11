import "dotenv/config";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
const positive = (fallback: number, max: number) =>
  z.coerce.number().int().min(1).max(max).default(fallback);
export const config = z
  .object({
    DATABASE_URL: z
      .string()
      .default("postgresql://basic:basic_local_only@localhost:55432/basic"),
    APP_ORIGIN: z.string().url().default("http://localhost:3400"),
    EVIDENCE_FRESH_DAYS: positive(14, 365),
    RATE_LIMIT_PER_MINUTE: positive(120, 10000),
    WORKER_DEADLINE_MS: positive(20000, 60000),
    WORKER_MAX_BYTES: positive(2097152, 8388608),
    LOG_RETENTION_DAYS: positive(14, 365),
    REQUEST_BODY_TIMEOUT_MS: positive(15000, 60000),
  })
  .parse(process.env);
export function log(
  event: string,
  fields: Record<string, string | number | boolean> = {},
) {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    event,
    ...fields,
  });
  console.log(line);
  if (process.env.LOG_DIR) {
    try {
      fs.mkdirSync(process.env.LOG_DIR, { recursive: true });
      fs.appendFileSync(
        path.join(
          process.env.LOG_DIR,
          "basic-" + new Date().toISOString().slice(0, 10) + ".jsonl",
        ),
        line + "\n",
        { mode: 0o600 },
      );
    } catch {
      console.error('{"event":"file-log-write-failed"}');
    }
  }
}
