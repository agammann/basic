import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { isPublicAddress, approveUrl } from "../src/lib/network";
import { evidenceFor } from "../src/lib/evidence";
import { deploymentMatches, parseTask } from "../src/lib/search";
import {
  profileSchema,
  searchSchema,
  type Verification,
} from "../src/lib/types";
import { getSetup } from "../src/lib/setup";
import { classifyCheck } from "../src/lib/verify";
import { validHostOrigin, readBoundedJson } from "../src/lib/http";
const p = profileSchema.parse(
  JSON.parse(fs.readFileSync("curation/profiles/microsoft-learn.json", "utf8")),
);
const d = p.deployments[0];
const run = (
  outcome: Verification["outcome"],
  date: string,
  id = "1",
): Verification => ({
  id,
  profile_id: p.id,
  deployment_id: d.id,
  target: d.endpoint!,
  version: p.version,
  started_at: date,
  duration_ms: 50,
  outcome,
  fingerprint: null,
  findings: "test fixture",
  tools: [],
});
describe("destination policy", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "192.0.2.1",
    "198.51.100.2",
    "203.0.113.2",
  ])("rejects %s", (ip) => expect(isPublicAddress(ip)).toBe(false));
  it("allows ordinary public addresses", () =>
    expect(isPublicAddress("1.1.1.1")).toBe(true));
  it.each([
    "http://example.com/mcp",
    "https://user:pass@example.com/mcp",
    "https://example.com:8443/mcp",
    "https://example.com/mcp#secret",
    "https://other.example/mcp",
  ])("rejects unapproved URL %s", (url) =>
    expect(() => approveUrl(url, ["https://example.com/mcp"])).toThrow(),
  );
});
describe("evidence", () => {
  it("latest failure supersedes old success", () => {
    const e = evidenceFor(
      d,
      p.version,
      [
        run("tools-listed", "2026-09-01T00:00:00Z"),
        run("failed", "2026-09-02T00:00:00Z", "2"),
      ],
      Date.parse("2026-09-03"),
    );
    expect(e.status).toBe("failed");
    expect(e.history).toHaveLength(2);
  });
  it("stale evidence retains outcome", () => {
    const e = evidenceFor(d, p.version, [
      run("tools-listed", "2020-01-01T00:00:00Z"),
    ]);
    expect(e.status).toBe("stale");
    expect(e.label).toBe("Tool list retrieved");
  });
  it("version changes invalidate inheritance", () =>
    expect(
      evidenceFor(d, "next", [run("tools-listed", new Date().toISOString())])
        .status,
    ).toBe("not-tested"));
  it("endpoint change invalidates inheritance", () =>
    expect(
      evidenceFor({ ...d, endpoint: "https://example.com/new" }, p.version, [
        run("tools-listed", new Date().toISOString()),
      ]).status,
    ).toBe("not-tested"));
  it("auth responses are classified without credentials", () => {
    expect(classifyCheck(401, false)).toBe("auth-required");
    expect(classifyCheck(403, false)).toBe("auth-required");
    expect(classifyCheck(500, false)).toBe("failed");
    expect(classifyCheck(500, true)).toBe("failed");
  });
});
describe("hard constraints", () => {
  it("does not match unknowns silently", () => {
    const u = { ...d, auth: "unknown" as const, pricing: "unknown" as const };
    expect(
      deploymentMatches(
        p,
        u,
        { auth: "none", pricing: "free", includeUnknown: false },
        [],
      ),
    ).toBe(false);
    expect(
      deploymentMatches(
        p,
        u,
        { auth: "none", pricing: "free", includeUnknown: true },
        [],
      ),
    ).toBe(true);
  });
  it("same deployment must meet all constraints", () =>
    expect(
      deploymentMatches(
        p,
        { ...d, kind: "local" },
        { setup: "remote", auth: "none", includeUnknown: false },
        [],
      ),
    ).toBe(false));
  it("read-only is not restricted credential support", () =>
    expect(
      deploymentMatches(
        p,
        d,
        { restrictedRead: true, includeUnknown: false },
        [],
      ),
    ).toBe(false));
  it("bounded query constraints can be disabled or edited", () => {
    expect(
      parseTask("websites without an API key", { includeUnknown: false })
        .filters.auth,
    ).toBe("none");
    expect(
      parseTask("free docs", { includeUnknown: false }, false).filters.pricing,
    ).toBeUndefined();
    expect(
      parseTask("free docs", { includeUnknown: false, pricing: "paid" }).filters
        .pricing,
    ).toBe("paid");
  });
  it("limits query and pagination", () => {
    expect(() => searchSchema.parse({ query: "a".repeat(241) })).toThrow();
    expect(() => searchSchema.parse({ page: 0 })).toThrow();
  });
});
describe("setup and HTTP boundaries", () => {
  it("terminates a stalled request body", async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("{"));
      },
    });
    const req = new Request("http://localhost:3400/mcp", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit);
    await expect(readBoundedJson(req, 32768, 30)).rejects.toThrow(
      "body-deadline",
    );
  });
  it("rejects executable or credential-bearing source links", () => {
    expect(() =>
      profileSchema.parse({ ...p, documentation: "javascript:alert(1)" }),
    ).toThrow();
    expect(() =>
      profileSchema.parse({
        ...p,
        repository: "https://secret:password@example.com",
      }),
    ).toThrow();
  });
  it("both client templates parse", () => {
    for (const client of ["vscode", "claude-code"] as const) {
      const s = getSetup(p, client, d.id);
      expect(
        ("configuration" in s && JSON.parse(s.configuration!).servers) ||
          ("configuration" in s && JSON.parse(s.configuration!).mcpServers),
      ).toBeTruthy();
    }
  });
  it("unknown deployment never generates instructions", () =>
    expect(getSetup(p, "vscode", "made-up")).toHaveProperty("missing"));
  it("rejects untrusted origin", () =>
    expect(
      validHostOrigin(
        new Request("http://localhost:3400/mcp", {
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toBe(false));
  it("bounds chunked request bodies", async () => {
    await expect(
      readBoundedJson(
        new Request("http://localhost:3400/mcp", {
          method: "POST",
          body: "x".repeat(40000),
        }),
      ),
    ).rejects.toThrow("body-too-large");
  });
  it("every curated source and template validates", () => {
    for (const file of fs.readdirSync("curation/profiles")) {
      const profile = profileSchema.parse(
        JSON.parse(fs.readFileSync("curation/profiles/" + file, "utf8")),
      );
      for (const deployment of profile.deployments)
        for (const client of ["vscode", "claude-code"] as const) {
          const s = getSetup(profile, client, deployment.id);
          if ("configuration" in s)
            expect(() => JSON.parse(s.configuration!)).not.toThrow();
        }
    }
  });
});
