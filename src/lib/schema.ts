import {
  pgTable,
  text,
  jsonb,
  timestamp,
  boolean,
  integer,
  bigserial,
} from "drizzle-orm/pg-core";
export const registryRecords = pgTable("registry_records", {
  name: text().primaryKey(),
  version: text().notNull(),
  status: text().notNull(),
  data: jsonb().notNull(),
  collectedAt: timestamp("collected_at", { withTimezone: true }).notNull(),
});
export const profiles = pgTable("profiles", {
  id: text().primaryKey(),
  registryName: text("registry_name").notNull(),
  published: boolean().notNull(),
  data: jsonb().notNull(),
});
export const versions = pgTable("server_versions", {
  key: text().primaryKey(),
  name: text().notNull(),
  version: text().notNull(),
  data: jsonb().notNull(),
});
export const deployments = pgTable("deployments", {
  key: text().primaryKey(),
  profileId: text("profile_id").notNull(),
  data: jsonb().notNull(),
});
export const tools = pgTable("tools", {
  key: text().primaryKey(),
  profileId: text("profile_id").notNull(),
  data: jsonb().notNull(),
});
export const claims = pgTable("claims", {
  key: text().primaryKey(),
  profileId: text("profile_id").notNull(),
  data: jsonb().notNull(),
});
export const setups = pgTable("setup_templates", {
  key: text().primaryKey(),
  profileId: text("profile_id").notNull(),
  data: jsonb().notNull(),
});
export const verificationRuns = pgTable("verification_runs", {
  id: bigserial({ mode: "number" }).primaryKey(),
  profileId: text("profile_id").notNull(),
  deploymentId: text("deployment_id").notNull(),
  target: text().notNull(),
  version: text().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  durationMs: integer("duration_ms").notNull(),
  outcome: text().notNull(),
  fingerprint: text(),
  findings: text().notNull(),
  tools: jsonb().notNull(),
});
export const syncRuns = pgTable("sync_runs", {
  id: bigserial({ mode: "number" }).primaryKey(),
  mode: text().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text().notNull(),
  cursor: text(),
  count: integer().notNull(),
  error: text(),
});
