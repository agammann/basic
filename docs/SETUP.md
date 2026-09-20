# Local setup

[Back to Basic](../README.md)

This guide runs the PostgreSQL application in this repository on your computer. To use the separately hosted website, open [Basic on OpenAI Sites](https://basic-agent-tools.alx21.chatgpt.site) with the owner's ChatGPT account. Local commands do not update that website.

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

The application and operator load `.env` through dotenv. A `.env` file is optional for the default local setup. If you need one, copy the example once, before editing it:

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Linux or macOS:

```sh
cp .env.example .env
```

Do not overwrite an existing `.env`. Keep it private. Use `.env` for settings shared by the application and operator commands; a Next.js `.env.local` file is not a substitute for operator configuration. Existing shell environment variables take precedence, so use a clean terminal or deliberately set the Basic values if another project's settings are present.

The defaults connect to database `basic` at `localhost:55432`, with the development credentials in [.env.example](../.env.example). Those credentials are only for the loopback bound local container. Changing `.env` does not change the Compose container's database credentials or port. Production uses separate roles and configuration described in [Deployment](../DEPLOYMENT.md).

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

After pulling a code update, stop the app, run `pnpm install --frozen-lockfile` and `pnpm db:migrate`, then restart. Run `pnpm catalog:curate` when reviewed profiles change. Back up data you need before migrations or catalog maintenance; see [Operations](../OPERATIONS.md). Removing Docker volumes deletes stored catalog data and is not a routine restart step.

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
| Hosted website returns 401 | The Sites edition is private. Use the owner's authorized ChatGPT session; local database commands do not change hosted access. |
