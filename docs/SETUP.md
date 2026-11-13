# Local setup

[Back to Basic](../README.md)

This guide runs the PostgreSQL application in this repository on your computer. The separately hosted [Basic website on OpenAI Sites](https://basic-agent-tools.alx21.chatgpt.site) supports anonymous browsing and `/api/mcp`; its installed plugin uses the authenticated `/mcp` endpoint. Local commands do not update that website.

## Prerequisites

| Dependency | Requirement |
| --- | --- |
| Node.js | 24.x; recorded release validation used 24.19.0 |
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

The script creates `.env` with a unique PostgreSQL password and a matching `DATABASE_URL`, then preserves that file on later runs. Keep it private. The application and operator load `.env` through dotenv; a Next.js `.env.local` file is not a substitute for operator configuration. Existing shell environment variables take precedence, so use a clean terminal or deliberately set the Basic values if another project's settings are present. Setting `DOTENV_CONFIG_OVERRIDE=true` explicitly gives `.env` precedence; `false` preserves the shell values, including empty values. Dotenv 17.4.2 treated the string `false` as enabled, so review that setting when upgrading.

The generated connection uses database `basic` at `localhost:55432`. Compose reads the same password from `.env` and publishes PostgreSQL only on loopback. Production uses separate roles and configuration described in [Deployment](../DEPLOYMENT.md).

## Create the local catalog

```sh
docker compose up -d --wait db
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

After pulling a code update, stop the app and run `pnpm install --frozen-lockfile`. If this installation predates generated local database credentials, follow the password rotation steps below before using the normal restart or migration steps; the new configuration requires `POSTGRES_PASSWORD` and a matching `DATABASE_URL`. Otherwise, run `pnpm db:migrate` and restart. Run `pnpm catalog:curate` when reviewed profiles change. Back up data you need before migrations or catalog maintenance; see [Operations](../OPERATIONS.md). Removing Docker volumes deletes stored catalog data and is not a routine restart step.

### Rotate an existing local database password

An existing `basic-data` volume retains its previous database password. Updating the source or creating `.env` does not rotate that role. Stop the app, keep the database available, and retain a verified backup before changing credentials. The local restore drill in the [operations guide](../OPERATIONS.md) removes its temporary dump; it does not retain a backup for this rotation.

If `.env` is absent, run `node scripts/setup-env.mjs` to generate a new password and matching URL. If it exists, generate a new password with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`, keep it private, and set both `POSTGRES_PASSWORD=<new password>` and `DATABASE_URL=postgresql://basic:<same new password>@localhost:55432/basic` in `.env`. The generated alphabet is URL safe. Preserve the other settings and the database volume.

Run `docker compose up -d --no-recreate db`, then `docker compose exec db psql -U basic -d basic`. At the `psql` prompt, enter `\password basic` and provide the new password twice. Exit with `\q`. The password prompts keep the value out of shell commands. Finish with `docker compose up -d --force-recreate --wait db` and `pnpm db:migrate`, then restart the app. If the migration cannot connect, check that both `.env` fields use the same new password before retrying; keep the backup and volume intact.

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
