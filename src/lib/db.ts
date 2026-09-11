import postgres from "postgres";
import { config } from "./config";
const globalDb = globalThis as unknown as {
  basicSql?: ReturnType<typeof postgres>;
};
export const sql =
  globalDb.basicSql ??
  postgres(config.DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 5,
    connection: { statement_timeout: 10000 },
    onnotice: () => {},
  });
if (process.env.NODE_ENV !== "production") globalDb.basicSql = sql;
export async function closeDb() {
  await sql.end({ timeout: 5 });
}
