# Changelog

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
