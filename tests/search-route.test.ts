import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { profileSchema } from "../src/lib/types";

// Only the database boundary is simulated. Exercise the real route, parameter
// parsing, schema validation, rate limiter, search shaping and response bounds.
const { sql } = vi.hoisted(() => ({ sql: vi.fn() }));
vi.mock("../src/lib/db", () => ({ sql }));
import { GET } from "../src/app/api/search/route";

const profile = profileSchema.parse(
  JSON.parse(fs.readFileSync("curation/profiles/microsoft-learn.json", "utf8")),
);
const request = (params = "q=documentation") =>
  new Request(`http://localhost:3400/api/search?${params}`);

function healthyDatabase(strings: TemplateStringsArray | string[]) {
  // postgres also accepts arrays to create SQL fragments.
  if (!("raw" in strings)) return [];
  const query = strings.join("?");
  if (query.startsWith("INSERT INTO rate_buckets")) return [{ count: 1 }];
  if (query.startsWith("SELECT p.data"))
    return [
      {
        data: profile,
        status: "active",
        registry_version: profile.version,
        rank: 1,
      },
    ];
  if (query.startsWith("SELECT v.*")) return [];
  throw Error("Unexpected fixture query");
}

beforeEach(() => {
  sql.mockReset();
  sql.mockImplementation(healthyDatabase);
});

describe("search HTTP error contract (database fixture)", () => {
  it.each([
    "page=0",
    "page=-1",
    "page=1.5",
    "page=101",
    "page=not-a-number",
    "q=" + "x".repeat(241),
    "setup=not-a-setup",
    "auth=not-an-auth-method",
    "verification=not-a-status",
  ])(
    "returns 400 for invalid input even during an outage: %s",
    async (params) => {
      sql.mockRejectedValue(Error("ECONNREFUSED private database details"));
      const response = await GET(request(params));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Invalid search" });
      expect(sql).not.toHaveBeenCalled();
    },
  );

  it.each(["rate limiter", "catalog", "evidence"])(
    "returns a non-leaking 503 when the %s database query fails, then recovers",
    async (stage) => {
      sql.mockImplementation((strings: TemplateStringsArray | string[]) => {
        if ("raw" in strings) {
          const query = strings.join("?");
          const failingQuery =
            stage === "rate limiter"
              ? "INSERT INTO rate_buckets"
              : stage === "catalog"
                ? "SELECT p.data"
                : "SELECT v.*";
          if (query.startsWith(failingQuery))
            throw Error(
              "ECONNREFUSED postgresql://private-host/catalog secret",
            );
        }
        return healthyDatabase(strings);
      });
      const unavailable = await GET(request());
      expect(unavailable.status).toBe(503);
      expect(unavailable.headers.get("cache-control")).toBe("no-store");
      expect(await unavailable.json()).toEqual({
        error: "Catalog unavailable",
      });

      sql.mockImplementation(healthyDatabase);
      const recovered = await GET(request());
      expect(recovered.status).toBe(200);
      expect((await recovered.json()).results[0].id).toBe(profile.id);
    },
  );

  it("keeps the successful result shape and no-store header", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(await response.json()).toMatchObject({
      query: "documentation",
      filters: { includeUnknown: false },
      inferred: [],
      total: 1,
      page: 1,
      limit: 10,
      truncated: false,
      results: [
        { id: profile.id, name: profile.name, version: profile.version },
      ],
    });
  });

  it("keeps an empty catalog response successful", async () => {
    sql.mockImplementation((strings: TemplateStringsArray | string[]) =>
      strings.join("?").startsWith("INSERT") ? [{ count: 1 }] : [],
    );
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ total: 0, results: [] });
  });

  it("keeps rate-limit rejection at 429", async () => {
    sql.mockResolvedValue([{ count: 121 }]);
    const response = await GET(request());
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "Rate limit exceeded" });
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("keeps origin and URL-length rejection ahead of database access", async () => {
    const rejected = await GET(
      new Request(request(), {
        headers: { Origin: "https://untrusted.example" },
      }),
    );
    expect(rejected.status).toBe(403);
    expect((await GET(request("q=" + "x".repeat(4096)))).status).toBe(414);
    expect(sql).not.toHaveBeenCalled();
  });
});
