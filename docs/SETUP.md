# Local setup

[Back to Basic](../README.md)

This guide runs the PostgreSQL application in this repository on your computer. The separately hosted [Basic website on OpenAI Sites](https://basic-agent-tools.alx21.chatgpt.site) supports anonymous browsing and `/api/mcp`; its installed plugin uses the authenticated `/mcp` endpoint. Local commands do not update that website.

## Prerequisites

| Dependency | Requirement |
| --- | --- |
| Node.js | For this checkout, 24.x or 26.13.1+ within 26.x; CI tests 24.19.0 and 26.13.1 on Linux. The published v1.0.0 archive predates Node 26 support. |
| pnpm | 11.19.0, as declared in package.json |
| Git | Available in the terminal |
| Docker | Engine or Desktop, Linux containers, Compose v2 |
| Local ports | 3400 for the application; 55432 for PostgreSQL |

Verify the tools before continuing:

```sh
node --version
npm --version
git --version
docker info --format '{{.OSType}}'
docker compose version
```

Docker should report `linux`. If the daemon is unavailable, start Docker Desktop or the Engine first. Package installation and the initial PostgreSQL image download need internet access. The curated catalog bootstrap uses files already in this repository.

## Install and configure

```sh
git clone https://github.com/agammann/basic.git
cd basic
npm install --global pnpm@11.19.0
pnpm --version
pnpm install --frozen-lockfile
```

Run all remaining commands from the `basic` directory. Commands work in PowerShell and a POSIX shell unless a platform is named. Run each command separately and resolve errors before continuing.

Generate local credentials before starting Docker:

```sh
node scripts/setup-env.mjs
```

The script creates `.env` with a unique PostgreSQL password and a matching `DATABASE_URL`, then preserves that file on later runs. Keep it private. The application and operator load `.env` through dotenv. Before initialization and throughout the commands that follow, unset inherited `DATABASE_URL`, `POSTGRES_PASSWORD`, all `PG*`, `COMPOSE_*`, `DOCKER_*` and `DOTENV_CONFIG_*` variables, `BASIC_PG18_FRESH_INSTALL`, the production `DB_*` password selectors and `BASIC_DOMAIN`. Remove those selectors from `.env` except its matching `DATABASE_URL` and `POSTGRES_PASSWORD`. Do not add an automatic Compose override or Next.js environment files such as `.env.local` or `.env.development.local`: they can redirect later commands independently of the helper. Custom contexts or overrides require a separately reviewed procedure. The helper checks these conditions and the exact default loopback URL/password before it starts Docker, but cannot enforce what is changed in the terminal afterward.

The generated connection uses database `basic` at `localhost:55432`. Compose reads the same password from `.env` and publishes PostgreSQL only on loopback. Production uses separate roles and configuration described in [Deployment](../DEPLOYMENT.md).

## Create the local catalog

These instructions are for the checked-out revision, not the published v1.0.0 archive. Before a fresh initialization, identify any previous Basic installation's actual Docker host, Compose project, volume or bind mount, `PGDATA`, overrides and remote database. The default guard sees only this project's `basic-data` mount; it cannot discover data under another project, external volume, bind mount, or remote server. A read-only mount does not stop other processes from writing to that volume, so stop potential Basic writers and storage changes throughout initialization. Do not use the fresh-install command when any existing Basic database may contain data. Keep its original checkout, mapping and verified backup and plan a separate migration as described in [the PostgreSQL rehearsal](postgres18-rehearsal.md).

Only after confirming that no Basic database exists, initialize the separate PostgreSQL 18 volume once. This command requires the exact confirmation phrase shown below and checks the default old and new volumes. It does not migrate data:

```sh
node scripts/confirm-postgres18-fresh.mjs local
```

The command starts the initialized database with the standard Compose file. Then run:

```sh
pnpm db:migrate
pnpm catalog:curate
pnpm dev
```

The migration command applies numbered SQL files. Curation loads the 30 reviewed profiles and their stored Registry snapshots. Neither step contacts listed MCP servers. Starting the app does not start the operator worker or run live Registry synchronization.

Keep `pnpm dev` running and open `http://localhost:3400` in your browser. The application listens on loopback; this is an address on your computer, not a public website.

## Check that it works

1. Open `http://localhost:3400/health`. Expect `status: "ok"` and `service: "Basic"`.
2. Open `http://localhost:3400/ready`. After a fresh bootstrap, expect `status: "ready"` and `profiles: 30`.
3. Search for `Search repository issues`, open the GitHub profile, and inspect its deployment requirements and sources.
4. Open `http://localhost:3400/connect` to inspect Basic's client setup templates.

On a fresh database, protocol evidence should say "Not tested". The JSON files in `reports/` describe prior runs; they do not populate current observations. To exercise real SDK calls against Basic, follow [Testing](TESTING.md).

## Stop and restart

Press Ctrl+C in the application terminal, then stop the local database:

```sh
docker compose stop db
```

The database volume remains intact. To resume:

```sh
docker compose up -d --wait db
pnpm dev
```

## PostgreSQL 18 initialization and recovery

The initialization helper validates the default local connection and password, asks for `NO EXISTING BASIC DATABASE`, and checks that the selected Compose project has no existing containers. The first-use override refuses a populated legacy `basic-data` volume, a nonempty `basic-data-18` target, an unreadable mount, or a prior initialization attempt. The final initialization script records the PostgreSQL cluster identifier after earlier initialization scripts succeed. Normal startup requires that marker, a valid PostgreSQL 18 cluster and an empty legacy volume. A cluster ID and marker do not prove the contents are complete or discover data stored elsewhere.

If initialization or the helper is interrupted, **do not remove or reset either volume and do not repeat the fresh command**. An initialization attempt may have created data or roles. Keep the old and new volumes, inspect the logs and actual mappings without exposing credentials, and arrange an installation-specific recovery. If PostgreSQL initialization completed and the helper was interrupted before switching back to the normal Compose file, the normal `docker compose up -d --wait db` verifies the marker and starts it. A missing or invalid marker, missing cluster, or populated legacy mount stops startup and requires review. Never fabricate a marker or remove a lock to force startup.

After pulling a code update, stop the app and run `pnpm install --frozen-lockfile`. An existing PostgreSQL 17 installation must remain on its previous source and mapping until separately migrated; the fresh-initialization command is not a migration. For an existing PostgreSQL 18 installation, run `pnpm db:migrate` and restart. Run `pnpm catalog:curate` when reviewed profiles change. Back up data you need before migrations or catalog maintenance; see [Operations](../OPERATIONS.md). Removing Docker volumes deletes stored catalog data and is not a routine restart step.

### Rotate an existing local database password

An existing PostgreSQL 17 `basic-data` volume retains its previous database password. Use the previous source revision and its matching Compose file to rotate it; this PostgreSQL 18 checkout intentionally refuses to start against that populated legacy volume. Updating the source or creating `.env` does not rotate a database role. Stop the app, keep the database available, and retain a verified backup before changing credentials. The local restore drill in the [operations guide](../OPERATIONS.md) removes its temporary dump; it does not retain a backup for this rotation.

In the **previous PostgreSQL 17 checkout**, if `.env` is absent, run `node scripts/setup-env.mjs` to generate a new password and matching URL. If it exists, generate a new password with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`, keep it private, and set both `POSTGRES_PASSWORD=<new password>` and `DATABASE_URL=postgresql://basic:<same new password>@localhost:55432/basic` in `.env`. The generated alphabet is URL safe. Preserve the other settings and the database volume.

Still in that **previous PostgreSQL 17 checkout**, run `docker compose up -d --no-recreate db`, then `docker compose exec db psql -U basic -d basic`. At the `psql` prompt, enter `\password basic` and provide the new password twice. Exit with `\q`. The password prompts keep the value out of shell commands. Finish with `docker compose up -d --force-recreate --wait db` and `pnpm db:migrate`, then restart the app. If the migration cannot connect, check that both `.env` fields use the same new password before retrying; keep the backup and volume intact.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `pnpm` is not found | Install the pinned version above, then reopen the terminal if its executable directory is not on PATH. |
| Docker cannot connect | Start Docker and confirm the Linux engine with `docker info`. |
| Port 55432 is already in use | Inspect the other listener before starting Basic. Do not stop an unrelated project's database. |
| Database connection fails | Check `docker compose ps db`, then `docker compose logs --tail=50 db`. Check private `.env` and shell settings locally; do not paste credentials into an issue. |
| `/ready` returns 503 with `empty` | Run migrations and curation against the same database the app uses, then retry. |
| `/ready` returns 503 with `unavailable` | Confirm database connectivity and migrations. `/health` alone does not prove database readiness. |
| Port 3400 is already in use | Stop your earlier Basic server before starting another one. |
| `pnpm start` reports missing build files | Run `pnpm build` first. Stop `pnpm dev` before starting production on the same port. |
| `applied-migration-changed` | Restore the original applied migration and create a new migration for the change. Do not delete migration history. |
| Hosted website returns 401 | The Sites edition is intended to be public. Confirm the URL above and report an unexpected access prompt; local database commands do not change hosted access. |
