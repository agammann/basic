# Basic

**Find the right tools for your agent.**

**Website: [Open Basic](https://basic-agent-tools.alx21.chatgpt.site)**

The hosted website runs on OpenAI Sites. Access is currently private to the owner's ChatGPT account.

Basic is a task-based search engine for MCP servers and tools. It combines official MCP Registry metadata with reviewed publisher sources, explicit unknown requirements, client setup templates and dated protocol observations. This repository contains the original PostgreSQL application, three read-only MCP tools and catalog operator tooling; no paid AI API or LLM key is needed. The hosted Sites edition is a separate deployment using D1 storage and reviewed catalog snapshots.

This is an initial developer-productivity release, not a safety certification. Initialization and listing tools do not prove functional capability. See [How checks work](docs/CHECKS.md), [architecture](ARCHITECTURE.md), [security](SECURITY.md), and [operations](OPERATIONS.md).

## Start here

| Your goal | Guide |
| --- | --- |
| Use the hosted website | [Open Basic](https://basic-agent-tools.alx21.chatgpt.site), subject to its access settings |
| Run this repository | [Local setup and troubleshooting](docs/SETUP.md) |
| Verify a change | [Testing guide](docs/TESTING.md) |
| Maintain the catalog | [Operations](OPERATIONS.md) |
| Host the PostgreSQL application | [Deployment](DEPLOYMENT.md) |
| Understand recorded results | [Report index](reports/README.md) and [current status](PROGRESS.md) |

The redesigned Sites website and its D1 deployment are maintained in a separate Sites project. Cloning this repository gives you the original PostgreSQL application and operator tools. Pushing to this GitHub repository does not redeploy the hosted website.

## Quick start for developers

Requirements: **Node.js 24.x** (tested 24.19.0), **pnpm 11.19.0**, Git, and Docker Engine/Desktop with Compose v2. Local PostgreSQL is pinned to 17.6. Run from the repository root. Port 3400 is the website and 55432 is local PostgreSQL. Do not reuse another project's database.

Start Docker with Linux containers enabled. Run each command separately and resolve errors before continuing. Use a fresh terminal without another project's database or application-origin settings.

```sh
git clone https://github.com/agammann/basic.git
cd basic
npm install --global pnpm@11.19.0
pnpm install --frozen-lockfile
docker compose up -d --wait db
pnpm db:migrate
pnpm catalog:curate
pnpm dev
```

After starting the local server, open `http://localhost:3400` in your browser. This address is only available on your own computer while the server is running. The local database defaults in `.env.example` are used when DATABASE_URL is unset; ensure an unrelated DATABASE_URL is not inherited from your shell. Copy `.env.example` to `.env` to customize it (`Copy-Item .env.example .env` in PowerShell, `cp .env.example .env` on Linux/macOS). Never commit `.env`.

The curated bootstrap loads **30 genuine, source-dated profiles**, not synthetic fixtures. It does not run network checks or execute discovered packages. A fresh database correctly shows “Not tested” until checks are run; archived test reports are not imported as new observations.

Open `http://localhost:3400/ready` and expect `status: "ready"` with 30 profiles after the initial bootstrap. Search for `I need a tool to search GitHub issues` and open the GitHub result. Stop the application with Ctrl+C; `docker compose stop db` stops PostgreSQL while preserving its data. See [Local setup](docs/SETUP.md) for restart and troubleshooting instructions.

## Operator commands

```sh
pnpm db:migrate
pnpm catalog:curate
pnpm catalog:sync
pnpm catalog:reconcile
pnpm catalog:check
pnpm catalog:stale
pnpm catalog:coverage
pnpm evaluate
```

`catalog:sync` follows cursors and uses an incremental checkpoint after a completed pass. `catalog:reconcile` performs a full latest-version lifecycle pass. Bad records are quarantined, not published. Review them before treating upstream coverage as complete. Import and check permissions are separate: only exact endpoints in `curation/approved-endpoints.json` are checked. Checks initialize and list schemas only, without credentials or tool execution.

Edit `curation/profiles/*.json`, preserving source dates and evidence scope, then run `catalog:curate`. Existing upstream metadata is not overwritten by bootstrap snapshots. Adding a profile does not approve its endpoint. See OPERATIONS.md for review and removal commands.

## Tests and production build

```sh
docker compose exec -T db createdb -U basic basic_test
pnpm test
pnpm typecheck
pnpm build
pnpm start
```

If `basic_test` already exists, omit `createdb`. Tests deliberately truncate that disposable database and refuse a different database name. `TEST_DATABASE_URL` can override the connection for CI but must still name `basic_test`.

Stop `pnpm dev` before the production build and leave `pnpm start` running in its own terminal. The [testing guide](docs/TESTING.md) separates application and test databases, browser prerequisites, report generation and live operator actions.

With the application running in another terminal:

```sh
pnpm exec playwright install chromium
pnpm test:browser
pnpm test:mcp
pnpm evaluate
pnpm backup:test
```

Browser tests cover desktop and mobile search, strict constraints, profiles, configuration copying, safe rendering and keyboard navigation. The MCP test uses the official SDK over real HTTP and calls all three tools. Routine tests use offline upstream fixtures; `catalog:check` and `catalog:sync` are the explicit live operations. `backup:test` uses the local `basic-db-1` container and creates/removes a disposable restoration database.

`fixtures` requires `ENABLE_FIXTURES=true` and `DATABASE_URL` naming `basic_test`. It loads a deliberately synthetic, unpublished record. Production refuses it.

## MCP connection

Local endpoint: `http://localhost:3400/mcp` (Streamable HTTP). Supported tools: `search_servers`, `get_server`, `get_setup_instructions`. See `/connect` for sourced VS Code and Claude Code JSON templates. These templates are syntax-checked; no claim is made that the third-party integrations were installed in those clients.

## Release status and deployment

Visit [Basic on OpenAI Sites](https://basic-agent-tools.alx21.chatgpt.site) for the hosted website. The Sites edition uses a reviewed catalog snapshot; it does not continuously run this repository's registry synchronization or publisher checks. Its current access is limited to the owner's ChatGPT account.

For this repository's PostgreSQL application, see [PROGRESS.md](PROGRESS.md) and [reports](reports/) for validation and catalog coverage. To host this application yourself, follow [DEPLOYMENT.md](DEPLOYMENT.md) for the included Docker Compose stack with Node, PostgreSQL, Caddy HTTPS, a scheduled worker and backups.

No source-code redistribution license has been selected or granted for this project. Public repository visibility does not resolve that decision. Third-party packages and source metadata retain their respective terms.

`pnpm start` serves the standalone production build on loopback port 3400. Set BASIC_HOST and PORT explicitly if you need a different local binding. Docker uses its own container listener and private production network. Routine GitHub Actions validation uses stored source snapshots and PostgreSQL fixtures, with no live publisher checks.
