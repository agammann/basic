import fs from "node:fs/promises";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { sql } from "./db";
import { controlledFetch } from "./network";
import { createHash } from "node:crypto";
const validators = new Map<
  string,
  ReturnType<InstanceType<typeof Ajv>["compile"]>
>();
export async function validateRecord(record: any) {
  record = structuredClone(record);
  if (
    record?.server?.repository &&
    Object.keys(record.server.repository).length === 0
  ) {
    delete record.server.repository;
    record._basic = {
      normalizations: [
        "Omitted empty optional repository object; raw snapshot retained in curation sources.",
      ],
    };
  }
  const schemaUrl = record?.server?.$schema;
  const date = /\/schemas\/(2025-12-11|2025-10-17|2025-09-29)\//.exec(
    schemaUrl ?? "",
  )?.[1];
  if (!date) throw Error("unsupported-registry-schema");
  if (!validators.has(date)) {
    const ajv = new Ajv({ strict: false, allErrors: false });
    addFormats(ajv);
    validators.set(
      date,
      ajv.compile(
        JSON.parse(await fs.readFile(`schemas/server-${date}.json`, "utf8")),
      ),
    );
  }
  if (!validators.get(date)!(record.server))
    throw Error("invalid-registry-record");
  const status =
    record._meta?.["io.modelcontextprotocol.registry/official"]?.status;
  if (!["active", "deprecated", "deleted"].includes(status))
    throw Error("invalid-lifecycle-status");
  return record;
}
export async function importRecords(
  tx: any,
  records: any[],
  quarantineInvalid = false,
) {
  for (const raw of records) {
    let record;
    try {
      record = await validateRecord(raw);
    } catch {
      if (!quarantineInvalid) throw Error("invalid-registry-record");
      const key = createHash("sha256")
        .update(JSON.stringify(raw))
        .digest("hex");
      await tx`INSERT INTO registry_quarantine(key,data,reason,collected_at) VALUES (${key},${tx.json(raw)},'Unsupported schema or invalid metadata; not imported or published',now()) ON CONFLICT(key) DO UPDATE SET collected_at=now()`;
      continue;
    }
    const s = record.server;
    const meta = record._meta["io.modelcontextprotocol.registry/official"];
    await tx`INSERT INTO server_versions(key,name,version,data) VALUES (${s.name + "@" + s.version},${s.name},${s.version},${tx.json(record)}) ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data`;
    if (meta.isLatest !== false)
      await tx`INSERT INTO registry_records(name,version,status,data,collected_at) VALUES (${s.name},${s.version},${meta.status},${tx.json(record)},now()) ON CONFLICT(name) DO UPDATE SET version=EXCLUDED.version,status=EXCLUDED.status,data=EXCLUDED.data,collected_at=EXCLUDED.collected_at`;
  }
}
export async function fetchRegistry(url: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await controlledFetch([url])(url);
      if (!r.ok) throw Error("registry-http-" + r.status);
      return await r.json();
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  throw Error("registry-unavailable");
}
export async function syncRegistry(full = false, fetchPage = fetchRegistry) {
  const conn = await sql.reserve();
  const mode = full ? "full" : "incremental";
  let runId: number | undefined;
  try {
    const [lock] = await conn`SELECT pg_try_advisory_lock(78143021) as locked`;
    if (!lock.locked) throw Error("sync-already-running");
    const [saved] =
      await conn`SELECT value FROM sync_state WHERE key=${mode + "-pending"}`;
    const [success] =
      await conn`SELECT value FROM sync_state WHERE key='last-success'`;
    let state = saved?.value ?? {
      started: new Date().toISOString(),
      since: full ? null : (success?.value?.at ?? null),
      cursor: null,
      count: 0,
    };
    const [run] =
      await conn`INSERT INTO sync_runs(mode,started_at,status,cursor,count) VALUES (${mode},now(),'running',${state.cursor},${state.count}) RETURNING id`;
    runId = run.id;
    const seen = new Set<string>();
    for (let pages = 0; pages < 1000; pages++) {
      const u = new URL(
        "https://registry.modelcontextprotocol.io/v0.1/servers",
      );
      u.searchParams.set("limit", "100");
      u.searchParams.set("version", "latest");
      if (state.cursor) u.searchParams.set("cursor", state.cursor);
      if (state.since)
        u.searchParams.set(
          "updated_since",
          new Date(Date.parse(state.since) - 60000).toISOString(),
        );
      const page = await fetchPage(u.href);
      if (
        !Array.isArray(page.servers) ||
        page.servers.length > 1000 ||
        typeof page.metadata !== "object"
      )
        throw Error("invalid-registry-page");
      const next = page.metadata.nextCursor ?? null;
      if (
        next !== null &&
        (typeof next !== "string" || seen.has(next) || next === state.cursor)
      )
        throw Error("repeated-registry-cursor");
      if (next) seen.add(next);
      const updated = {
        ...state,
        cursor: next,
        count: state.count + page.servers.length,
      };
      await sql.begin(async (tx) => {
        await importRecords(tx, page.servers, true);
        await tx`INSERT INTO sync_state(key,value) VALUES (${mode + "-pending"},${tx.json(updated)}) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`;
        await tx`UPDATE sync_runs SET cursor=${next},count=${updated.count} WHERE id=${runId!}`;
      });
      state = updated;
      if (!next) {
        await sql.begin(async (tx) => {
          await tx`INSERT INTO sync_state(key,value) VALUES ('last-success',${tx.json({ at: state.started })}) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`;
          await tx`DELETE FROM sync_state WHERE key=${mode + "-pending"}`;
          await tx`UPDATE sync_runs SET status='complete',finished_at=now() WHERE id=${runId!}`;
        });
        return { count: state.count, mode };
      }
    }
    throw Error("page-limit");
  } catch (e) {
    if (runId)
      await conn`UPDATE sync_runs SET status='failed',finished_at=now(),error='Upstream or validation failure; catalog retained. Retry this mode.' WHERE id=${runId}`;
    throw e;
  } finally {
    await conn`SELECT pg_advisory_unlock(78143021)`;
    conn.release();
  }
}
