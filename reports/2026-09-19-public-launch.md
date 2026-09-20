# Public website launch

The owner authorized public access on September 19, 2026 (America/Los_Angeles). Sites access was changed to `public` and independently checked with requests carrying no cookies, bearer tokens or API keys.

Website: [Basic](https://basic-agent-tools.alx21.chatgpt.site).

## Anonymous website checks

At `2026-09-20T02:14:19.875Z`, `pnpm test:acceptance` against the public website passed:

- 35 of 35 search scenarios; zero hard constraint violations.
- All 30 profile pages, complete pagination and three information routes.
- Invalid pagination returns HTTP 400.
- Missing profiles display a not-found message; this hosted streaming response returns HTTP 200.

The browser search "I need a tool to search GitHub issues" also returned the GitHub profile. The browser may retain an owner session; the separate HTTP checks establish anonymous access.

## Hosted connection correction

The original hosted `/mcp` endpoint returned HTTP 404 even though the local Worker supported it. The Sites edition now exposes the same bounded, rate-limited, origin-checked handler at `/api/mcp`, and its connection templates use that path. The public PostgreSQL edition retains `/mcp`.

The Sites source passed TypeScript checking and a production build. Source commit: `9297e100db5c02f5019f6c3c5a9cdaacd369291e`.

Sites version 3 deployed successfully at `2026-09-20T02:19:01.027020+00:00`. After deployment, the official SDK connected to the public `/api/mcp` endpoint without credentials, initialized, listed all three tools, called all three successfully, matched website search results and confirmed rejection of an untrusted Origin. The browser displayed the public access wording and the new endpoint in both client templates. Sites access was read back as `public`.

Reproduce from this repository in PowerShell:

```powershell
$env:TEST_BASE_URL='https://basic-agent-tools.alx21.chatgpt.site'
$env:TEST_MCP_URL='https://basic-agent-tools.alx21.chatgpt.site/api/mcp'
pnpm test:acceptance
pnpm test:mcp
```

## Scope

These are agent-run checks. No external participant feedback has been collected. Installation in VS Code and Claude Code remains unverified. Provider requirements and dated protocol observations remain visible; public access to Basic does not authenticate a visitor to catalog publishers. See the [earlier acceptance report](2026-09-19-acceptance.md) for the pre-launch evidence and its historical private-access boundary.
