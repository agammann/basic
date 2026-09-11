# Checks and evidence

Metadata validated: a record passed its supported official registry schema (with an explicit empty-optional-repository normalization where applicable). Invalid/unsupported records are quarantined.

MCP initialization passed: the exact deployment completed the SDK handshake. Tool list retrieved: initialization and paginated tool/schema listing completed. Neither means a functional tool was called. Authentication required: 401/403 was returned without supplying a credential. Check failed: connection/protocol/policy failed. A partial initialized result explicitly says listing did not complete. Not tested: no applicable attempt. Evidence stale: latest applicable attempt is older than EVIDENCE_FRESH_DAYS (14 by default).

Latest attempt wins, including failures. Historical successes remain visible but do not replace newer failures. Endpoint or version changes invalidate inherited applicability. Schema fingerprints identify what was listed in that attempt; the product does not infer functional compatibility from an unchanged fingerprint.

Live coverage is reported in `reports/verification-coverage.json`. Archived reports are dated evidence, not automatically fresh claims. Fresh checkouts start with no verification rows. To collect new evidence, review `curation/approved-endpoints.json`, then run `pnpm catalog:check`.
