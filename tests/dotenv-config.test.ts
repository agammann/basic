import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import dotenv from "dotenv";

const content = [
  "DATABASE_URL=postgresql://basic:synthetic@localhost:55432/basic",
  "POSTGRES_PASSWORD=synthetic",
  'QUOTED="hello # world"',
  "EQUALS=a=b",
  "EXISTING_EMPTY=from_file",
  "",
].join("\n");

function load(override?: string) {
  const directory = mkdtempSync(join(tmpdir(), "basic-dotenv-contract-"));
  const file = join(directory, ".env");
  try {
    writeFileSync(file, content);
    const env: NodeJS.ProcessEnv = {
      SystemRoot: process.env.SystemRoot,
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://shell:synthetic@localhost:55432/basic",
      EXISTING_EMPTY: "",
      DOTENV_CONFIG_QUIET: "true",
    };
    if (override !== undefined) env.DOTENV_CONFIG_OVERRIDE = override;
    const command = [
      "--require",
      createRequire(import.meta.url).resolve("dotenv/config"),
      "--eval",
      "console.log(JSON.stringify({url:process.env.DATABASE_URL,password:process.env.POSTGRES_PASSWORD,quoted:process.env.QUOTED,empty:process.env.EXISTING_EMPTY}))",
    ];
    const result = spawnSync(process.execPath, command, {
      cwd: directory,
      env,
      encoding: "utf8",
      windowsHide: true,
    });
    expect(result.status, result.stderr).toBe(0);
    return JSON.parse(result.stdout.trim());
  } finally {
    unlinkSync(file);
    rmdirSync(directory);
  }
}

it("parses the local configuration syntax", () => {
  expect(dotenv.parse(content)).toMatchObject({
    POSTGRES_PASSWORD: "synthetic",
    QUOTED: "hello # world",
    EQUALS: "a=b",
  });
});

it("preserves existing shell values by default and with override=false", () => {
  for (const override of [undefined, "false"]) {
    expect(load(override)).toEqual({
      url: "postgresql://shell:synthetic@localhost:55432/basic",
      password: "synthetic",
      quoted: "hello # world",
      empty: "",
    });
  }
});

it("uses file values when override=true is explicitly set", () => {
  expect(load("true")).toEqual({
    url: "postgresql://basic:synthetic@localhost:55432/basic",
    password: "synthetic",
    quoted: "hello # world",
    empty: "from_file",
  });
});
