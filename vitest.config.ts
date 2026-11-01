import "dotenv/config";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
const sourceUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!sourceUrl) throw new Error("DATABASE_URL required for tests");
const testUrl = new URL(sourceUrl);
if (!process.env.TEST_DATABASE_URL) {
  if (!["localhost", "127.0.0.1"].includes(testUrl.hostname))
    throw new Error("Default test database must be local");
  testUrl.pathname = "/basic_test";
}
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
    env: {
      DATABASE_URL: testUrl.href,
      APP_ORIGIN: "http://localhost:3400",
    },
  },
});
