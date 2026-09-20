# Validation reports

[Back to Basic](../README.md)

Latest targeted checks: [September 19 acceptance report](2026-09-19-acceptance.md) and [browser results](2026-09-19-browser-tests.json). These cover the natural task phrasing fix and distinguish local checks, live website checks and one real publisher invocation.

These files preserve results from particular runs of the PostgreSQL application. Check each artifact's timestamp and scope before quoting it. The original release summary was recorded on September 11, 2026. These reports do not describe current third party availability or audit the separate Sites deployment.

| Report | What it records | How it is produced |
| --- | --- | --- |
| [Release validation](release-validation.json) | Recorded tests, builds, database roles, security fix verification and deployment limitations | Maintainer summary assembled from actual release checks |
| [Browser journeys](browser-tests.json) | Browser test outcomes | `pnpm test:browser` |
| [Search evaluation](search-evaluation.json) | Fixed search cases, constraint checks and a local benchmark | `pnpm evaluate` |
| [Verification coverage](verification-coverage.json) | Catalog counts and dated protocol observations | `pnpm catalog:coverage` |
| [Backup restoration](backup-restore.json) | Local dump and restoration drill | `pnpm backup:test` |

The release report's `publicWebsiteDeployed: false` records the state of the original PostgreSQL release. The separate private Sites website was published later; see [current project status](../PROGRESS.md). Preserve the original report rather than changing old results to describe a newer deployment.

Report commands can replace their corresponding JSON files. Preserve prior results in Git history, inspect the diff, and record the tested commit and environment alongside new evidence. Do not commit regenerated reports merely because a documentation edit ran a command.

For current CI status, consult [GitHub Actions](https://github.com/agammann/basic/actions/workflows/ci.yml). For reproduction instructions, see [Testing](../docs/TESTING.md).
