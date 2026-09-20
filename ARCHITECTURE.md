# Architecture

This document describes the PostgreSQL source in this repository. The separately maintained [hosted Sites edition](https://basic-agent-tools.alx21.chatgpt.site) uses D1 and a reviewed catalog snapshot. See the [README](README.md) for the relationship between the two editions.

One TypeScript product has two operating roles: Next.js serves pages/HTTP MCP reads, and a scheduled operator process imports metadata and runs approved checks. Both use reusable modules in `src/lib`; PostgreSQL persists all catalog data. There is no AI provider, vector database, message broker, account service, WebMCP integration or general crawler.

## Persistence and authority

- `registry_records` holds the latest accepted upstream record, lifecycle status, version and collection time.
- `server_versions` retains version-specific snapshots. `registry_quarantine` retains invalid/unsupported raw metadata with a sanitized reason, outside discovery.
- `profiles` is the published editorial projection. `deployments`, `tools`, `claims` and `setup_templates` preserve the separately structured enrichments. The projection supports fast read-only profile responses without N+1 joins.
- `verification_runs` is append-only operational history with exact endpoint/version, outcome, duration, schema fingerprint and collected tool definitions. No third-party tools are called.
- `sync_runs` and `sync_state` track attempts and transactional page checkpoints. Failed pages do not advance cursors. Import failures do not delete profiles.
- `rate_buckets` implements a shared database-backed rate limit across application replicas.

Drizzle's TypeScript table declarations describe the relational model; the postgres TypeScript driver executes parameterized statements and numbered SQL migrations. Its connection is intentionally not passed into Drizzle's runtime adapter, which changes JSON serialization behavior. Migrations have a recorded SHA-256 checksum and a PostgreSQL advisory lock.

Editorial bootstrap only inserts missing registry identities. Later curation changes cannot roll back newer upstream metadata. Only explicit deleted statuses exclude a profile; deprecated profiles retain a visible label. A partial import never implies deletion. Curated version drift is shown separately from the current registry version.

## Search

Stored weighted tsvectors give weight A to names and curated tasks, B to tool names/descriptions, C to server descriptions. Meaningful query concepts are joined with AND; a maintained synonym map uses OR inside a concept. This is deterministic English text search, not semantic inference. Only the bounded tested phrases for no API key, free, local/remote and restricted credentials become filters; controls display and override them.

All required deployment constraints must hold on the same deployment. Unknown auth, pricing or restricted permissions never silently pass a hard constraint. Include-unknown is explicit. Category, deployment, auth, price and protocol evidence filtering share the same module for web and MCP.

The initial implementation retrieves at most 2,000 text candidates before applying deployment filters. This is above the 30-profile release scope; before publishing thousands of profiles, move all deployment filters and counting into indexed relational SQL. Pagination is bounded to 100 pages of at most 20 results. Relevance is the primary ordering, evidence collection date is secondary.

## Network boundaries

The public application makes no upstream catalog or verification requests. The worker uses exact operator-reviewed HTTPS URLs, checks every DNS answer, connects directly to a selected public address with TLS SNI/certificate validation, and validates the connected remote address. Redirects are rejected. Response streams, tool pages, schemas, request bodies and total check time are bounded. No subprocess transports or package installation are used.

MCP uses the official v1 SDK WebStandardStreamableHTTPServerTransport in stateless JSON mode within Next.js Node routes. POST performs initialization and calls; standalone GET SSE and session deletion return 405. Each request gets an isolated server/transport. Rate limits and Host/Origin checks precede processing. The real SDK client test verifies the lifecycle and web/MCP result parity.

## Primary documentation checked during implementation

- https://modelcontextprotocol.io/registry/about
- https://modelcontextprotocol.io/registry/registry-aggregators
- https://modelcontextprotocol.io/docs/sdk
- https://ts.sdk.modelcontextprotocol.io/
- https://nextjs.org/docs/app/getting-started/installation
- https://code.visualstudio.com/docs/agent-customization/mcp-servers
- https://code.claude.com/docs/en/mcp
- https://learn.chatgpt.com/docs/extend/mcp?surface=cli

Schema snapshots under `schemas/` are from official static schema URLs. Empty optional repository objects are omitted in a documented normalization; original curated registry captures are retained. Other invalid or unsupported records are quarantined without granting them published or checked status.

Search fetches only the newest attempt per deployment using an indexed lateral query and omits schema JSON. Relevant evidence timestamps break equal relevance scores. Profile history is paginated in PostgreSQL, 20 metadata records at a time. Current badges are computed independently of the historical page. Full schemas remain in operator storage.
