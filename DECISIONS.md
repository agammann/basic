# Decisions

- 2026-09-09: Next.js App Router, PostgreSQL 17, Drizzle schema plus versioned SQL migrations, official MCP TypeScript SDK v1 stable. Node 24.
- Registry imports and editorial curation are separate. Public reads use PostgreSQL only. Records require explicit curation to publish; network checks require separate exact endpoint approval.
- Original implementation: Docker Compose with Caddy HTTPS, persistent PostgreSQL, and an independent worker.
- September 13, 2026: the owner requested a hosted website on OpenAI Sites. A separate D1 edition now serves the redesigned website from reviewed snapshots. This repository retains the PostgreSQL application and operator; its pushes do not redeploy Sites.
- No AI provider, accounts, third-party credentials, WebMCP, arbitrary execution, or analytics.
- Public source repository creation and publication were explicitly requested by the owner. No redistribution license is granted; the licensing decision remains unresolved and is recorded in README.md.
- Visual system: white background, charcoal text, ultramarine accent, open result rows, thin rules, 16px body, native labeled controls, readable mobile layout. Generated concept is a visual reference only; live evidence comes from the database.
