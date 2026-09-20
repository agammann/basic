# Testing and validation

[Back to Basic](../README.md)

These checks apply to the PostgreSQL source in this repository. Complete [Local setup](SETUP.md) first. Run commands from the repository root. The hosted Sites edition has a separate build and deployment process.

## Unit tests and production build

Keep the local database running. Create the disposable test database once:

```sh
docker compose exec -T db createdb -U basic basic_test
```

If `basic_test` already exists from an earlier run, skip creation. Tests intentionally truncate tables in that database and refuse a database name other than `basic_test`. Never point them at data you want to keep. The default test connection matches the local Compose credentials and port; `TEST_DATABASE_URL` can override it through the shell environment, as CI does.

Stop any running development server before the production build. Then run:

```sh
pnpm typecheck
pnpm test
pnpm evaluate
pnpm build
```

`pnpm test` uses the disposable test database. `pnpm evaluate` reads the curated application database, so migrations and curation must already have completed there. Evaluation writes `reports/search-evaluation.json`; review generated report changes before committing them.

## Browser and MCP checks

Install Chromium once:

```sh
pnpm exec playwright install chromium
```

On a Linux machine missing browser system libraries, use `pnpm exec playwright install --with-deps chromium`; that command may require system package installation privileges.

In terminal A, start the production build and leave it running:

```sh
pnpm start
```

Confirm `http://localhost:3400/ready` reports `ready`. In terminal B, from the same repository root:

```sh
pnpm test:browser
pnpm test:mcp
pnpm test:acceptance
```

Browser tests cover desktop and mobile search, filtering, profiles, copying, safe rendering and keyboard navigation. The MCP test uses the official SDK to initialize Basic, list and call all three tools, compare web search results, and check rejection of an untrusted Origin. It does not execute discovered third party tools or prove installation in VS Code or Claude Code.

The tests default to `http://localhost:3400`. For a separately deployed PostgreSQL instance under your control, set `TEST_BASE_URL` in the shell to its origin without a trailing slash. A deployment must contain the curated profiles the tests expect. The private Sites gate is not handled by these test scripts.

`pnpm test:acceptance` exercises 35 search scenarios over HTTP, checks every returned deployment against the requested requirements, traverses all catalog pages, opens all 30 profiles and the information pages, and checks invalid input and missing profiles. It prints results without replacing archived reports. It also works against a locally running Sites edition using `TEST_BASE_URL`. These are agent-run acceptance checks, not collected feedback from real users.

## Local recovery drill

With the default Basic Compose database running and populated:

```sh
pnpm backup:test
```

This script specifically uses the `basic-db-1` container and the `basic` database, regardless of `DATABASE_URL`. It creates a temporary database named `basic_restore_test_<timestamp>`, restores a dump, compares counts and exercises search, then removes that temporary database. It writes `reports/backup-restore.json`. It does not restore over the source database and does not test recovery from an independent backup location.

## Catalog and report checks

| Command | Effect |
| --- | --- |
| `pnpm catalog:coverage` | Reads catalog and observation data; writes `reports/verification-coverage.json` |
| `pnpm catalog:stale` | Lists stale and untested deployments without network checks |
| `pnpm evaluate` | Runs the fixed search cases and local benchmark; writes the evaluation report |
| `pnpm catalog:sync` | Contacts the official Registry and writes imported or quarantined metadata |
| `pnpm catalog:reconcile` | Performs a full Registry lifecycle pass |
| `pnpm catalog:check` | Contacts only approved endpoints and writes protocol observations |

Live synchronization and checks are operator actions, not prerequisites for the offline test suite. Follow [Operations](../OPERATIONS.md) before running them. Synthetic fixture loading is separately guarded by `ENABLE_FIXTURES=true`, a `DATABASE_URL` naming `basic_test`, and a nonproduction environment. It is not part of normal setup.

## CI and evidence

[GitHub Actions](https://github.com/agammann/basic/actions/workflows/ci.yml) runs the checked in [validation workflow](../.github/workflows/ci.yml): dependency installation, fresh PostgreSQL bootstrap, typecheck, unit and integration tests, evaluation, production build, browser journeys and the SDK test. It uses stored source snapshots and does not run live publisher checks. The local backup drill and deployment host checks are separate.

See the [report index](../reports/README.md) for each artifact's scope and timestamp. A historical passing report is evidence for that recorded run, not proof of the current commit or live deployment. The [evaluation protocol](../evaluation/README.md) explains the fixed cases and scoring limits.
