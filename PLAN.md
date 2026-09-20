# Basic implementation plan

Historical plan for the original PostgreSQL implementation. These milestones are complete; see [Progress](PROGRESS.md) for dated results and the separate Sites deployment, or [Local setup](docs/SETUP.md) to run the code.

1. Database, three genuine profiles, search and profile UI. Acceptance: PostgreSQL backed search links to dated sourced records.
2. Registry synchronization, 30 curated profiles, strict filters and client setup. Acceptance: imports are idempotent, editorial data survives sync, unknowns do not meet constraints.
3. Approved remote checks. Acceptance: DNS and socket destination protection, bounded SDK initialization/listing, immutable dated history and latest failures visible.
4. Read-only Streamable HTTP MCP. Acceptance: real SDK client initializes and calls all three tools using shared catalog logic.
5. Release preparation. Acceptance: automated tests, browser journeys, 20 development and 10 held-out search cases, latency measurement, backup restoration, production build and deployment configuration.

Self hosting the PostgreSQL edition requires a host/domain and resource configuration. The separate Sites edition is deployed with private access. Source redistribution licensing remains unresolved.
