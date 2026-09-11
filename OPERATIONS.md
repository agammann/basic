# Operations

Run commands from the repository root with Node 24 and pnpm 11.19.0. The operator needs the writable operator database connection; the public app must use its separate reader connection in production. Local defaults are only for development.

## Routine maintenance

1. `pnpm db:migrate` applies numbered, checksum-checked SQL migrations under a lock.
2. Review `curation/profiles/*.json` against linked publisher sources. Collection dates are observation dates, not publisher update dates. Unknown values must remain explicit. `pnpm catalog:curate` publishes only the explicitly curated profiles; it cannot overwrite existing upstream snapshots.
3. `pnpm catalog:sync` imports official Registry pages. It follows cursors, retries bounded failures (3 attempts with exponential backoff), and uses `updated_since` with a one-minute overlap after completed syncs. A transaction writes accepted records, quarantines invalid records and advances the page cursor together.
4. `pnpm catalog:reconcile` performs a full latest-version pass to reconcile explicit lifecycle status. Missing records in any partial/full list are not inferred deleted. The worker runs incremental hourly, full daily, checks daily, serially with database locks. Restarting may repeat a full pass, safely and idempotently.
5. Review exact destinations in `curation/approved-endpoints.json`, then `pnpm catalog:check`. Approval is separate from import/publication. No credentials are sent. Never add a URL from public input without operator review.
6. `pnpm catalog:stale` lists untested and stale deployments. Review version/endpoint changes before renewing evidence. Preserve older attempts; don't delete a failure to improve a badge.

The registry is preview infrastructure and does not guarantee availability. Last known accepted catalog records remain usable during outages. A new sync can quarantine malformed or unsupported records while completing the valid portion; inspect `registry_quarantine` before describing total discovery coverage. No quarantined record is automatically published or checked.

## Failure recovery

Read sanitized event logs and `sync_runs`. Retry the same command to resume its committed cursor. If an upstream reset invalidates a cursor, inspect the reason, take a backup, delete only the affected pending checkpoint key (`incremental-pending` or `full-pending`) in `sync_state`, then run a full reconciliation. Do not truncate the catalog or infer deletion from a failed run. Review unsupported schema versions against official schema documentation before adding an adapter.

For a suspected malicious profile, set `published` to false in its curation JSON, run `pnpm catalog:curate`, and remove its endpoint approval. Verify its profile becomes unavailable and search omits it. Retain source and check history for investigation. A registry deleted status automatically excludes ordinary discovery; deprecated entries remain visibly labeled.

## Backups and restoration

The production backup service runs `pg_dump --format=custom --no-owner --no-acl` daily and only renames completed dumps to `.dump`. The default 14-day retention is configurable. The volume is persistent on the host, but is not an off-host backup: copy encrypted backups to an operator-chosen independent destination before relying on disaster recovery. No paid storage is created by this project.

Local restore drill: `pnpm backup:test` dumps `basic`, creates a disposable `basic_restore_test_<timestamp>` database in the Basic container, restores with `pg_restore --exit-on-error`, compares core table counts and runs full-text search, then drops that disposable database. See `reports/backup-restore.json` for the actual tested result. It never restores over the running source database.

Production restoration procedure: stop the worker and app, preserve the damaged database and current volume, create a NEW database, restore the selected dump with `pg_restore --no-owner --no-acl --exit-on-error`, then apply role grants/migrations as required. Verify counts, readiness, search and the real SDK client against the new database. Switch DATABASE_URL only after validation. Preserve the previous database until rollback is no longer needed.

## Migration and deployment rollback

Back up before migration. Checksum mismatches stop migration; do not edit an already applied migration. Write a new migration. Each migration is transactional. Avoid destructive schema changes without an independently tested recovery plan. This release has additive migrations only.

For code rollback, restore the previously tested container image/commit and restart web/worker against a compatible database. Do not assume an older binary can read a newer schema. If incompatible, restore the pre-migration backup into a new database and switch connections as above. The supplied rollback instructions are operational procedures; only the local dump/restore drill has been executed here.

## Logs and limits

No raw search queries, credential headers or third-party tool response bodies are intentionally logged. Worker JSON events contain time, command/outcome and counts. Optional daily files under LOG_DIR are removed after LOG_RETENTION_DAYS (14 default). Docker service logs separately rotate at 10 MiB × 3 files; size rotation is not a time-retention guarantee. Caddy access logging is not enabled. Hosting infrastructure may have its own logging policy.

Rate limits default to 120 requests/minute per hashed client identity. TRUST_PROXY is valid only behind the supplied isolated Caddy path, which overwrites the client-IP header. Missing trusted identity uses a shared bucket. The worker removes rate buckets older than one day. Tune limits with a workload test before increasing exposure.

## Dependency updates and evaluation

Review official release notes/advisories; update exact package versions and pnpm-lock.yaml together. Run typecheck, unit/integration tests, build, browser journeys, real SDK tests and the fixed search evaluation. Live checks are separate from routine CI. Keep the 20 development and 10 held-out cases distinct; do not rewrite acceptable results to conceal misses. Add newly observed failures to a future evaluation revision with an explanation.

Record pilot feedback with `docs/PILOT.md`; a copied config is not a successful installation. No customer feedback or demand has been collected.
