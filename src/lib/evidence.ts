import type { Deployment, Verification } from "./types";
import { config } from "./config";
export function evidenceFor(
  deployment: Deployment,
  version: string,
  runs: Verification[],
  now = Date.now(),
) {
  const history = runs
    .filter((r) => r.deployment_id === deployment.id)
    .sort(
      (a, b) =>
        Date.parse(b.started_at) - Date.parse(a.started_at) ||
        Number(b.id) - Number(a.id),
    );
  const latest = history[0];
  if (
    !latest ||
    latest.target !== deployment.endpoint ||
    latest.version !== version
  )
    return {
      status: "not-tested",
      label: "Not tested",
      latest: undefined,
      history,
    };
  const stale =
    now - Date.parse(latest.started_at) > config.EVIDENCE_FRESH_DAYS * 86400000;
  const labels: Record<string, string> = {
    "tools-listed": "Tool list retrieved",
    initialized: "MCP initialization passed",
    "auth-required": "Authentication required",
    failed: "Check failed",
  };
  return {
    status: stale ? "stale" : latest.outcome,
    label: labels[latest.outcome],
    stale,
    latest,
    history,
  };
}
