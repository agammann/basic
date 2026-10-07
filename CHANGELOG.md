# Changelog

## 1.0.0

- Deliver the PostgreSQL catalog/search application as a versioned source ZIP with a SHA256 checksum, lockfile, migrations, setup guides and MIT license.
- Preserve the bounded catalog workflow: 30 source-dated profiles, task search and constraints, evidence-aware profiles, and the three read-only Streamable HTTP MCP tools.
- Update the MCP SDK to 1.31.0 and pin patched `proxy-addr` and `source-map-js` transitive versions.
- Publish from an exact main commit only after the complete application validation and source packaging jobs pass. Release retries verify draft ownership, tag identity and asset digests before publication.

The source distribution supports local PostgreSQL installation and includes Linux deployment instructions. Public HTTPS deployment, host firewall enforcement, off-host backups and production capacity remain deployment-specific validation work. The hosted Sites edition is maintained separately.

## September 19, 2026

Natural task wording such as "I need a tool to search GitHub issues" now finds matching catalog entries. Both the PostgreSQL source and separate hosted Sites edition received the correction. Added regression tests and an HTTP acceptance command covering search, filters, pagination and profile routes. Added setup, troubleshooting and testing guides, clarified the two deployment editions, and recorded the [acceptance results](reports/2026-09-19-acceptance.md).

## 0.1.0

- PostgreSQL-backed task search, deployment constraints and evidence-aware profiles.
- 30 curated genuine profiles with registry identity, publisher sources, dated claims and explicit unknowns.
- Controlled registry synchronization, schema validation/normalization/quarantine and transactional resume checkpoints.
- Approved remote MCP initialization/listing with historical outcomes, schema fingerprints and freshness handling.
- Read-only Streamable HTTP catalog MCP with three tools and shared web search logic.
- Reviewed VS Code/Claude Code setup templates, copy controls and explicit missing-information states.
- Tests, fixed search evaluation, local latency report, Docker deployment configuration, backups and recovery documentation.

Public website deployment is separate from this source release. No source-code license was selected.

The release includes fixes for three findings from the initial Codex Security review: excluded production environment material from container build inputs, contained malformed upstream response conversion, and bounded public evidence retrieval without raw schema payloads. Regression tests and both image builds passed. Additional guards reject unsafe source URLs and stalled MCP request bodies.
