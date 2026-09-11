import { cp, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import "dotenv/config";
await mkdir(".next/standalone/.next", { recursive: true });
await cp(".next/static", ".next/standalone/.next/static", { recursive: true });
const child = spawn(process.execPath, [".next/standalone/server.js"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    HOSTNAME: process.env.BASIC_HOST ?? "127.0.0.1",
    PORT: process.env.PORT ?? "3400",
  },
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
child.on("error", () => {
  console.error("Basic could not start. Run pnpm build first.");
  process.exitCode = 1;
});
