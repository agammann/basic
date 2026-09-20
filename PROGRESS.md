# Progress

## Current status

The [Sites website](https://basic-agent-tools.alx21.chatgpt.site) was published on September 13, 2026. The owner authorized public access on September 19, 2026; visitors can browse and use its catalog MCP endpoint without signing in. Its D1 application is maintained separately from this PostgreSQL repository.

See the [public launch report](reports/2026-09-19-public-launch.md) for anonymous checks and the hosted `/api/mcp` connection path.

September 19, 2026: realistic task testing reproduced an empty result for "I need a tool to search GitHub issues". Both search implementations now ignore generic request wording while retaining meaningful terms and requirement filters. See the [acceptance report](reports/2026-09-19-acceptance.md) for current test evidence and limitations.

## Original PostgreSQL release validation

The results below describe the recorded September 11, 2026 release, not a fresh audit of every subsequent change. See the [report index](reports/README.md) and [testing guide](docs/TESTING.md).

All five implementation milestones and local release verification are complete. Public source publication was explicitly authorized. No paid host or domain has been provisioned, and no source license has been granted.

1. PostgreSQL migrations and a working search, profile and setup journey are implemented.
2. The catalog contains 30 genuine profiles with dated sources, separate deployments, explicit unknowns and two client template formats. Registry synchronization processed 29,147 records: 28,319 accepted and 828 quarantined. Imports never publish profiles or authorize checks.
3. Eight approved remote deployments were attempted. Six returned tool lists and two required authentication. Eleven historical attempts are retained. No third party tools were executed.
4. Basic exposes three catalog MCP tools through the official SDK and Streamable HTTP. Real SDK calls and web result parity passed locally and in Docker, including the production reader role.
5. All 48 unit and integration tests, the final production build, both Docker image builds and all eight desktop/mobile journeys pass after the security fixes. Search evaluation passed all 25 answerable top three cases and all five no match cases, with zero hard constraint violations. The final image excludes the harmless production environment sentinel. Backup restoration passed with 28,319 registry records and retained verification history.

Codex Security reviewed the original 157 source inventory files and reported three medium findings. Fixes exclude production secrets from build inputs, contain upstream response conversion errors, and keep full schema history out of public response materialization. Regression cases cover these code paths. See SECURITY.md for deployment assumptions and limits.

Remaining actions for a separate Linux deployment are choosing a host and domain, supplying runtime credentials, validating host egress and HTTPS, setting up independent encrypted backups and recording rollback ownership. [Deployment](DEPLOYMENT.md) contains that procedure; it is separate from the existing Sites publication.
