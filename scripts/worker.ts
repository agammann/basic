import { run } from "./operator";
import { sql, closeDb } from "../src/lib/db";
import { config, log } from "../src/lib/config";
import fs from "node:fs/promises";
import path from "node:path";
let stopping = false;
let wake: (() => void) | undefined;
const stop = () => {
  stopping = true;
  wake?.();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
let lastFull = 0,
  lastCheck = 0;
try {
  while (!stopping) {
    const now = Date.now();
    for (const command of [
      now - lastFull > 86400000 ? "reconcile" : "sync",
      ...(now - lastCheck > 86400000 ? ["check"] : []),
    ]) {
      if (stopping) break;
      try {
        await run(command);
        if (command === "reconcile") lastFull = now;
        if (command === "check") lastCheck = now;
        log("worker-complete", { command });
      } catch {
        log("worker-failed", { command });
      }
    }
    await sql`DELETE FROM rate_buckets WHERE window_at < now()-interval '1 day'`;
    if (process.env.LOG_DIR) {
      const dir = path.resolve(process.env.LOG_DIR);
      for (const name of await fs.readdir(dir)) {
        if (!/^basic-\d{4}-\d{2}-\d{2}\.jsonl$/.test(name)) continue;
        const file = path.join(dir, name);
        if (
          Date.now() - (await fs.stat(file)).mtimeMs >
          config.LOG_RETENTION_DAYS * 86400000
        )
          await fs.unlink(file);
      }
    }
    if (!stopping)
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 3600000);
        wake = () => {
          clearTimeout(t);
          resolve();
        };
      });
  }
} finally {
  await closeDb();
  log("worker-stopped");
}
