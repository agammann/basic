import { it, expect, vi, afterEach } from "vitest";
import https from "node:https";
import dns from "node:dns/promises";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { controlledFetch } from "../src/lib/network";
afterEach(() => vi.restoreAllMocks());
it.each([
  { status: 600, headers: {} },
  { status: 200, headers: { "invalid\nheader": "value" } },
])(
  "contains invalid asynchronous upstream response $status",
  async ({ status, headers }) => {
    vi.spyOn(dns, "lookup").mockResolvedValue([
      { address: "1.1.1.1", family: 4 },
    ] as any);
    vi.spyOn(https, "request").mockImplementation(((
      _options: any,
      callback: any,
    ) => {
      const req = Object.assign(new EventEmitter(), {
        end() {
          queueMicrotask(() => {
            const response = Object.assign(new PassThrough(), {
              statusCode: status,
              headers,
            });
            callback(response);
          });
        },
        destroy() {},
        write() {},
      });
      return req;
    }) as any);
    await expect(
      controlledFetch(["https://example.com/mcp"])("https://example.com/mcp"),
    ).rejects.toThrow("invalid-upstream-response");
    expect(true).toBe(true); // Execution continues after the untrusted response callback.
  },
);
