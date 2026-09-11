# Security boundaries

Basic is a discovery catalog, not a safety scanner. Namespace ownership does not establish vendor endorsement. Read-only tool descriptions do not establish restricted credential permissions. Protocol connectivity does not prove useful or safe execution.

The public app has a read-only catalog database role in production, with limited writes only to rate-limit buckets. The operator role maintains catalog tables but is not a PostgreSQL cluster superuser. No upstream credentials are stored. Client templates contain placeholders and configuration copying never installs software.

Descriptions, sources and schemas are untrusted. React escapes all displayed text; no raw HTML/Markdown renderer or `dangerouslySetInnerHTML` is used. Tailwind scans only `src`, not source captures. Configuration is JSON stringified from reviewed data. Scripts do not execute advertised commands.

SQL is parameterized. Dynamic identifiers come only from internal constant lists. Migration SQL is checked-in operator code and never user input. Migrations, synchronization and checks have advisory locks. The operator's endpoints cannot be supplied by website users.

The verification/enrichment fetcher allows exact HTTPS destinations on port 443, rejects credentials/fragments/redirects, checks all DNS answers against nonpublic ranges, pins the selected address, validates the actual socket destination and preserves TLS certificate validation. It strips authorization and cookie headers. Limits: 20-second total check deadline, 2 MiB per response, 64 KiB outbound JSON, 200 tool schemas and five listing pages; checks run serially. DNS rebinding cannot change the connection after resolution.

The production worker's dedicated egress subnet must have `deploy/worker-egress.sh` applied on the Linux host before its first start. It permits public HTTPS and rejects nonpublic destinations; PostgreSQL uses a separate internal network. Docker DNS resolves names; the application independently validates answers. The supplied host firewall has not been exercised on this Windows machine; verify it on the chosen Linux host before exposure. Do not claim OS-level egress isolation from local application tests alone.

HTTP applies Host/Origin allowlists, request URL/body bounds, database-backed rate limits, no-store API responses, X-Content-Type-Options, frame denial, Referrer-Policy, Permissions-Policy and CSP. Caddy adds HTTPS/HSTS and an ingress body limit. Never expose the Node port directly in production when TRUST_PROXY=true; Caddy overwrites X-Basic-Client-IP. Missing proxy identity uses a shared bucket rather than trusting arbitrary forwarded headers.

The CSP allows inline framework scripts/styles; a nonce-based strict policy is a future hardening item. There are no app accounts or cookies. The MCP interface is intentionally public and does not enable writes to discovered services.

Report a suspected malicious listing to the repository maintainer without posting secrets or exploit credentials. Operators can unpublish a profile immediately using the curation file and retain its history for investigation. Do not put sensitive vulnerability details in a public issue; request a private reporting channel if one is not configured.

Dependencies are exact-version pinned with a lockfile. Review upstream advisories and release notes before updates. Container base tags are pinned to explicit versions, not immutable digests; resolve and pin digests for the chosen deployment architecture before production rollout.

The build copies an explicit list of product inputs. Docker also excludes environment files and private key files, including `deploy/production.env`. Credentials enter containers only through runtime configuration. The image regression check uses a harmless sentinel.

Public evidence contains metadata only. Search loads the newest indexed attempt per deployment; profile history has pages of 20 metadata rows. Full schemas stay in operator storage and never enter public search or profile responses. Response conversion exceptions become sanitized failures. Partial schemas are discarded if collection fails. MCP request bodies have a configurable total deadline of 15 seconds by default.
