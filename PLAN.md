# Basic implementation plan

1. Database, three genuine profiles, search and profile UI. Acceptance: PostgreSQL backed search links to dated sourced records.
2. Registry synchronization, 30 curated profiles, strict filters and client setup. Acceptance: imports are idempotent, editorial data survives sync, unknowns do not meet constraints.
3. Approved remote checks. Acceptance: DNS and socket destination protection, bounded SDK initialization/listing, immutable dated history and latest failures visible.
4. Read-only Streamable HTTP MCP. Acceptance: real SDK client initializes and calls all three tools using shared catalog logic.
5. Release preparation. Acceptance: automated tests, browser journeys, 20 development and 10 held-out search cases, latency measurement, backup restoration, production build and deployment configuration.

Public deployment requires an authorized host/domain and resource configuration. Source redistribution licensing remains unresolved.
