# Acceptance check: September 19, 2026

## Reproduced problem and correction

On the deployed Sites website, "I need a tool to search GitHub issues" returned zero matches even though GitHub was present. The parser treated generic request wording as required search terms. Both the PostgreSQL and D1 implementations now omit that wording while preserving meaningful task terms and strict deployment filters. The deployed website was checked again after publication and returned the GitHub profile for the same sentence.

Sites version 2 uses source commit `3b0c0035c3461566714a1acf07a4b644cc09b392`. Its deployment succeeded at `2026-09-20T01:00:49Z` (September 19 in the testing timezone, America/Los_Angeles). The public PostgreSQL source change and its regression tests are included with this report.

## Technical results

| Check | Result and scope |
| --- | --- |
| Unit and integration tests | 52 passed against the disposable PostgreSQL test database |
| Production builds | PostgreSQL/Next.js and Sites/Vinext builds passed; Sites TypeScript check passed |
| Browser suite | All 8 existing desktop and mobile journeys passed against the local PostgreSQL production build |
| HTTP search acceptance | 35 of 35 cases passed against each local production build: the unchanged 30 baseline cases and 5 additional natural-language or no-match cases |
| Strict requirements | Zero returned deployment violations across those scenarios in either edition |
| Catalog routes | All 30 profile pages, complete pagination and 3 information routes passed in each build |
| Invalid input | Invalid search pagination returned HTTP 400 in both builds |
| Missing profile | Both editions showed an unavailable/not-found page; Sites returned 404, while the Next.js streamed response had already sent 200 |
| Basic MCP | Official SDK initialized, listed and called all 3 tools against each local production build; web result parity and rejection of an untrusted Origin passed |
| Live website | Owner sign-in, task search, profile navigation, configuration display, copy success feedback, strict filters, mobile filter expansion and submission were exercised |
| Mobile layout | Checked the live website at 390 by 844 pixels; no document overflow was observed |
| Live publisher | Connected without credentials to `https://learn.microsoft.com/api/mcp`, listed its 3 tools, and successfully called `microsoft_docs_search` with a public Python environment documentation query; the response contained Microsoft Learn documentation links |

Reproduce the HTTP checks with `pnpm test:acceptance` while Basic is running. See [Testing](../docs/TESTING.md) for the other commands and database isolation. Existing September 11 reports remain historical artifacts; this document does not reinterpret them as current results.

## Limits and real-user pilot

The Site is still private to the owner. A visitor without access cannot use the hosted catalog, and the private endpoint was not verified from an external MCP client. The tested client SDK connections were against local Basic builds and the public Microsoft Learn service. No credentials were collected or publisher write tools invoked.

The live copy button reported success, but the browser automation clipboard bridge returned no data, so an independent clipboard readback was not established in this session. The configuration text rendered correctly. Installation in VS Code or Claude Code remains untested.

No outside user was recruited, contacted or observed. The searches were agent-run realistic scenarios, not customer feedback or evidence of demand. The successful Microsoft Learn invocation is one dated example, not verification of every listed server or publisher claim. The broader catalog retains its original source and observation dates.

Use the [pilot worksheet](../docs/PILOT.md) with actual participants after the owner chooses the site's audience. Record their own task, selected tool, actual connection outcome, confusing steps and repeat-use intent without collecting secrets or private task content.
