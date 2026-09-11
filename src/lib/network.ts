import https from "node:https";
import dns from "node:dns/promises";
import { Readable } from "node:stream";
import ipaddr from "ipaddr.js";
import { config } from "./config";
export class NetworkError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export function isPublicAddress(address: string) {
  try {
    const a = ipaddr.process(address);
    return a.range() === "unicast";
  } catch {
    return false;
  }
}
export function approveUrl(raw: string, allowed: readonly string[]) {
  const u = new URL(raw);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.hash ||
    (u.port && u.port !== "443") ||
    !allowed.includes(u.href)
  )
    throw new NetworkError("destination-not-approved");
  return u;
}
/** Exact allowlist, all-answer DNS validation, pinned TLS destination, no redirects, streaming byte limit. */
export function controlledFetch(
  allowed: readonly string[],
  totalSignal?: AbortSignal,
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = input instanceof Request ? input.url : String(input);
    const u = approveUrl(raw, allowed);
    const signal = AbortSignal.any([
      AbortSignal.timeout(config.WORKER_DEADLINE_MS),
      ...(totalSignal ? [totalSignal] : []),
      ...(init?.signal ? [init.signal] : []),
    ]);
    const answers = await Promise.race([
      dns.lookup(u.hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) =>
        signal.addEventListener(
          "abort",
          () => reject(new NetworkError("deadline")),
          { once: true },
        ),
      ),
    ]);
    signal.throwIfAborted();
    if (!answers.length || answers.some((a) => !isPublicAddress(a.address)))
      throw new NetworkError("nonpublic-destination");
    const chosen = answers[0];
    return new Promise<Response>((resolve, reject) => {
      const headers = Object.fromEntries(
        new Headers(
          init?.headers ??
            (input instanceof Request ? input.headers : undefined),
        ),
      );
      delete headers.host;
      delete headers.authorization;
      delete headers.cookie;
      const req = https.request(
        {
          hostname: chosen.address,
          family: chosen.family,
          servername: u.hostname,
          path: u.pathname + u.search,
          method:
            init?.method ?? (input instanceof Request ? input.method : "GET"),
          headers: { ...headers, host: u.host },
          signal,
          agent: false,
        },
        (res) => {
          try {
            if (
              !res.statusCode ||
              res.statusCode < 200 ||
              res.statusCode > 599
            ) {
              throw new NetworkError("invalid-response-status");
            }
            if ((res.statusCode ?? 0) >= 300 && (res.statusCode ?? 0) < 400) {
              res.destroy();
              reject(new NetworkError("redirect-rejected"));
              return;
            }
            if (
              Number(res.headers["content-length"] ?? 0) >
              config.WORKER_MAX_BYTES
            ) {
              res.destroy();
              reject(new NetworkError("response-too-large"));
              return;
            }
            let bytes = 0;
            const stream = Readable.toWeb(res) as ReadableStream<Uint8Array>;
            const limited = stream.pipeThrough(
              new TransformStream<Uint8Array, Uint8Array>({
                transform(chunk, controller) {
                  bytes += chunk.byteLength;
                  if (bytes > config.WORKER_MAX_BYTES) {
                    req.destroy();
                    throw new NetworkError("response-too-large");
                  }
                  controller.enqueue(chunk);
                },
              }),
            );
            const responseHeaders = new Headers();
            for (const [key, value] of Object.entries(res.headers))
              if (value)
                responseHeaders.set(
                  key,
                  Array.isArray(value) ? value.join(", ") : value,
                );
            resolve(
              new Response(
                [204, 205, 304].includes(res.statusCode ?? 0) ? null : limited,
                { status: res.statusCode, headers: responseHeaders },
              ),
            );
          } catch {
            res.destroy();
            reject(new NetworkError("invalid-upstream-response"));
          }
        },
      );
      req.on("socket", (socket) =>
        socket.on("secureConnect", () => {
          if (
            !socket.remoteAddress ||
            ipaddr.process(socket.remoteAddress).toString() !==
              ipaddr.process(chosen.address).toString() ||
            !isPublicAddress(socket.remoteAddress)
          ) {
            req.destroy(new NetworkError("destination-mismatch"));
          }
        }),
      );
      req.on("error", () =>
        reject(
          new NetworkError(signal.aborted ? "deadline" : "connection-failed"),
        ),
      );
      if (init?.body) {
        if (typeof init.body !== "string") {
          req.destroy();
          reject(new NetworkError("unsupported-request-body"));
          return;
        }
        if (Buffer.byteLength(init.body) > 65536) {
          req.destroy();
          reject(new NetworkError("request-too-large"));
          return;
        }
        req.write(init.body);
      }
      req.end();
    });
  }) as typeof fetch;
}
