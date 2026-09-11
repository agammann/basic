import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { sql } from "./db";
import { getServer } from "./search";
import { controlledFetch } from "./network";
import { config, log } from "./config";
import { z } from "zod";
export const approvalSchema = z.object({
  profileId: z.string(),
  deploymentId: z.string(),
  endpoint: z.string().url(),
  reviewedAt: z.string().datetime(),
  reason: z.string().min(10),
});
export function classifyCheck(
  status: number | undefined,
  _initialized: boolean,
) {
  return status === 401 || status === 403 ? "auth-required" : "failed";
}
export async function runApprovedChecks() {
  const approvals = z
    .array(approvalSchema)
    .max(50)
    .parse(
      JSON.parse(await fs.readFile("curation/approved-endpoints.json", "utf8")),
    );
  const conn = await sql.reserve();
  const [{ locked }] =
    await conn`SELECT pg_try_advisory_lock(78143022) as locked`;
  if (!locked) {
    conn.release();
    throw Error("check-already-running");
  }
  const results = [];
  try {
    for (const a of approvals) {
      const p = await getServer(a.profileId);
      const d = p?.deployments.find(
        (x) =>
          x.id === a.deploymentId &&
          x.endpoint === a.endpoint &&
          x.transport === "streamable-http",
      );
      if (!p || !d) throw Error("approval-does-not-match-curated-deployment");
      const started = new Date();
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        config.WORKER_DEADLINE_MS,
      );
      const client = new Client(
        { name: "basic-protocol-check", version: "0.1.0" },
        { capabilities: {} },
      );
      let initialized = false,
        status: number | undefined,
        outcome = "failed",
        fingerprint: string | null = null,
        findings = "Protocol check failed; no capability claim.",
        tools: unknown[] = [];
      const guarded = controlledFetch([a.endpoint], controller.signal);
      const fetcher: typeof fetch = async (i, o) => {
        const r = await guarded(i, o);
        if (r.status >= 400) status = r.status;
        return r;
      };
      try {
        const transport = new StreamableHTTPClientTransport(
          new URL(a.endpoint),
          { fetch: fetcher },
        );
        await client.connect(transport, {
          timeout: config.WORKER_DEADLINE_MS,
          signal: controller.signal,
        });
        initialized = true;
        outcome = "initialized";
        findings = "MCP initialization passed; tool listing incomplete.";
        let cursor: string | undefined;
        const seen = new Set<string>();
        for (let page = 0; page < 5; page++) {
          const listed = await client.listTools(cursor ? { cursor } : {}, {
            timeout: config.WORKER_DEADLINE_MS,
            signal: controller.signal,
          });
          const combined = [...tools, ...listed.tools];
          if (
            combined.length > 200 ||
            Buffer.byteLength(JSON.stringify(combined)) >
              config.WORKER_MAX_BYTES
          )
            throw Error("schema-limit");
          tools = combined;
          cursor = listed.nextCursor;
          if (!cursor) break;
          if (seen.has(cursor)) throw Error("repeated-tool-cursor");
          seen.add(cursor);
        }
        if (cursor) throw Error("tool-page-limit");
        fingerprint = createHash("sha256")
          .update(JSON.stringify(tools))
          .digest("hex");
        outcome = "tools-listed";
        findings = `MCP initialized; ${tools.length} tool schemas listed. No tools executed.`;
      } catch {
        tools = [];
        outcome = classifyCheck(status, initialized);
        findings =
          outcome === "auth-required"
            ? "The endpoint requires authentication; no credentials were sent."
            : initialized
              ? "MCP initialized, but tool listing did not complete."
              : "Connection or initialization failed within the controlled policy.";
      } finally {
        clearTimeout(timer);
        controller.abort();
        await client.close().catch(() => {});
      }
      await sql`INSERT INTO verification_runs(profile_id,deployment_id,target,version,started_at,duration_ms,outcome,fingerprint,findings,tools) VALUES (${p.id},${d.id},${a.endpoint},${p.version},${started.toISOString()},${Date.now() - started.getTime()},${outcome},${fingerprint},${findings},${sql.json(tools as any)})`;
      results.push({
        id: p.id,
        target: a.endpoint,
        outcome,
        toolCount: tools.length,
      });
      log("protocol-check", {
        profile: p.id,
        outcome,
        toolCount: tools.length,
      });
    }
    return results;
  } finally {
    await conn`SELECT pg_advisory_unlock(78143022)`;
    conn.release();
  }
}
