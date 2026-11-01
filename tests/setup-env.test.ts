import { afterEach, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(
  new URL("../scripts/setup-env.mjs", import.meta.url),
);
const template = fileURLToPath(new URL("../.env.example", import.meta.url));
const directories: string[] = [];

afterEach(() => {
  const tempRoot = fs.realpathSync(os.tmpdir());
  for (const directory of directories.splice(0)) {
    const resolved = fs.realpathSync(directory);
    if (
      path.dirname(resolved) !== tempRoot ||
      !path.basename(resolved).startsWith("basic-env-")
    )
      throw new Error("Unexpected test fixture path");
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "basic-env-"));
  directories.push(directory);
  fs.copyFileSync(template, path.join(directory, ".env.example"));
  return directory;
}

function run(directory: string) {
  return spawnSync(process.execPath, [script], {
    cwd: directory,
    encoding: "utf8",
    timeout: 5000,
  });
}

it("creates matching, unique database credentials for new installations", () => {
  const first = fixture();
  const second = fixture();
  const firstRun = run(first);
  const secondRun = run(second);
  expect(firstRun.status, firstRun.stderr).toBe(0);
  expect(secondRun.status, secondRun.stderr).toBe(0);

  function password(directory: string) {
    const content = fs.readFileSync(path.join(directory, ".env"), "utf8");
    const value = content.match(
      /^POSTGRES_PASSWORD=([A-Za-z0-9_-]{43})$/m,
    )?.[1];
    expect(value).toBeDefined();
    const url = new URL(content.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "");
    expect(url.username).toBe("basic");
    expect(url.password).toBe(value);
    expect(url.hostname).toBe("localhost");
    expect(url.port).toBe("55432");
    return value;
  }
  const firstPassword = password(first);
  const secondPassword = password(second);
  expect(firstPassword).not.toBe(secondPassword);
  expect(firstRun.stdout).not.toContain(firstPassword);
  if (process.platform !== "win32")
    expect(fs.statSync(path.join(first, ".env")).mode & 0o777).toBe(0o600);
});

it("preserves an existing environment even when its template is absent", () => {
  const directory = fixture();
  expect(run(directory).status).toBe(0);
  const file = path.join(directory, ".env");
  const before = fs.readFileSync(file, "utf8");
  fs.unlinkSync(path.join(directory, ".env.example"));
  expect(run(directory).status).toBe(0);
  expect(fs.readFileSync(file, "utf8")).toBe(before);
});

it("does not create an environment from a missing or malformed template", () => {
  const directory = fixture();
  fs.writeFileSync(path.join(directory, ".env.example"), "DATABASE_URL=\n");
  expect(run(directory).status).toBe(1);
  expect(fs.existsSync(path.join(directory, ".env"))).toBe(false);
});
