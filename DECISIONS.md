# Decisions

- 2026-09-09: Next.js App Router, PostgreSQL 17, Drizzle schema plus versioned SQL migrations, official MCP TypeScript SDK v1 stable. Node 24.
- Registry imports and editorial curation are separate. Public reads use PostgreSQL only. Records require explicit curation to publish; network checks require separate exact endpoint approval.
- Docker Compose deployment with Caddy HTTPS, persistent PostgreSQL, and an independent worker. Sites' Worker/D1 starter does not meet the explicitly requested Node/PostgreSQL deployment; preserve the user's architecture.
- No AI provider, accounts, third-party credentials, WebMCP, arbitrary execution, or analytics.
- Public source repository creation and publication were explicitly requested by the owner. No redistribution license is granted; the licensing decision remains unresolved and is recorded in README.md.
- Visual system: white background, charcoal text, ultramarine accent, open result rows, thin rules, 16px body, native labeled controls, readable mobile layout. Generated concept is a visual reference only; live evidence comes from the database.
