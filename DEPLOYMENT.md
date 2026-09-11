# Deployment

The chosen deployment is a single Linux Docker host running the checked-in production Compose stack. It serves the website and Streamable HTTP MCP from Next.js/Node, stores PostgreSQL on a persistent volume, schedules a separate worker, terminates HTTPS with Caddy, and writes daily backup dumps. No host, paid service, domain or public website has been provisioned by the local build.

## Resource assumptions

Start evaluation with 2 vCPU, 4 GiB RAM and 20 GiB persistent disk; building images may require additional memory and disk. These are engineering assumptions for a small catalog/pilot, not measured production capacity or a pricing quote. Hosting, bandwidth, domain, backup retention and off-host storage can cost money. Obtain current provider pricing and explicit spending authorization before provisioning.

## Prepare and start

Use a Linux host with Docker Engine/Compose v2 and iptables compatible with Docker's DOCKER-USER chain. If the host uses a different firewall backend, adapt and validate the rules first. Choose a domain you control, point DNS to the host, and allow inbound TCP 80/443. PostgreSQL and Node have no public port bindings.

```sh
git clone https://github.com/agammann/basic.git
cd basic
cp deploy/production.env.example deploy/production.env
```

Edit the private `deploy/production.env`: set BASIC_DOMAIN and three distinct random hexadecimal database passwords (at least 32 bytes). Hex avoids URI escaping problems. The example values are placeholders and must be replaced. Keep this file private and excluded from Git. No credentials belong in profile curation.

```sh
docker compose --env-file deploy/production.env -f compose.production.yaml config --quiet
docker compose --env-file deploy/production.env -f compose.production.yaml build
docker compose --env-file deploy/production.env -f compose.production.yaml up -d --wait db
docker compose --env-file deploy/production.env -f compose.production.yaml --profile ops run --rm migrate
docker compose --env-file deploy/production.env -f compose.production.yaml --profile ops run --rm curate
sudo sh deploy/worker-egress.sh
docker compose --env-file deploy/production.env -f compose.production.yaml up -d web caddy worker backup
```

`db-init.sh` creates a catalog reader role and a non-superuser operator role on the first initialization. Changing environment passwords later does not rotate existing PostgreSQL role passwords; perform deliberate SQL credential rotation and update dependent services together.

The worker's egress network uses 172.30.89.0/24, with address 172.30.89.10. Confirm it does not conflict with existing host networks. The firewall rules affect only that source address. The internal database network is separate. Persist firewall rules using the host's supported mechanism and verify after every reboot. IPv6 is not enabled for this egress network. The app-level fetcher independently rejects nonpublic IPv4/IPv6 destinations.

Caddy obtains certificates after the domain resolves and inbound ports are reachable. Confirm `https://YOUR_DOMAIN/health` and `/ready`, browse a real search/profile, then set TEST_BASE_URL to that HTTPS origin and run `pnpm test:mcp`. APP_ORIGIN must exactly match the public origin; it drives Host/Origin validation and generated Basic setup URLs.

## Before calling deployment complete

- Pin container digests for the chosen architecture and inspect current image/dependency advisories.
- Verify the Linux host egress rules and that database/Node ports are unreachable from the internet.
- Verify the reader cannot write catalog tables and can update rate-limit buckets.
- Check worker sync/check history, review quarantine, inspect log rotation and confirm a completed backup.
- Copy an encrypted backup to an independent location; restore into a disposable database and test search/MCP.
- Record the deployed commit/image IDs, environment configuration source, recovery owner and HTTPS URL.

The local reports distinguish tested code, local Docker recovery and third-party protocol observations from production deployment. Host firewall enforcement, public HTTPS, off-host backup and production rollback are pending the chosen host. Do not infer deployment from public GitHub availability.

## Rollback

Record the old image ID before upgrade. Run a backup, migrate with the operator role, then replace web/worker. If readiness or SDK checks fail, restore the previous compatible image and verify again. For an incompatible migration, restore the prior dump into a new database and switch connections after validation; never overwrite the only existing copy. See OPERATIONS.md.
