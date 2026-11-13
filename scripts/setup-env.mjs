import { randomBytes } from "node:crypto";
import {
  closeSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";

function createEnvironment() {
  try {
    lstatSync(".env");
    return false;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const template = readFileSync(".env.example", "utf8");
  if (
    !/^DATABASE_URL=\r?$/m.test(template) ||
    !/^POSTGRES_PASSWORD=\r?$/m.test(template)
  )
    throw new Error(
      ".env.example must contain empty database credential fields",
    );

  const password = randomBytes(32).toString("base64url");
  const content = template
    .replace(
      /^DATABASE_URL=\r?$/m,
      `DATABASE_URL=postgresql://basic:${password}@localhost:55432/basic`,
    )
    .replace(/^POSTGRES_PASSWORD=\r?$/m, `POSTGRES_PASSWORD=${password}`);

  let descriptor;
  try {
    descriptor = openSync(".env", "wx", 0o600);
  } catch (error) {
    if (error.code === "EEXIST") return false;
    throw error;
  }
  try {
    writeFileSync(descriptor, content);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  return true;
}

if (createEnvironment())
  console.log(
    "Created local .env with a random database password. Do not commit it.",
  );
else
  console.log(
    "Existing .env preserved; see docs/SETUP.md for password rotation.",
  );
