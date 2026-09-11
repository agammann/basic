import { z } from "zod";
const httpsUrl = z
  .string()
  .url()
  .max(2048)
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  }, "Expected an HTTPS URL without credentials");
export const sourceSchema = z.object({
  url: httpsUrl,
  collectedAt: z.string().datetime(),
  kind: z.enum(["documented", "observed", "unknown"]),
  scope: z.string().max(300),
});
export const claimSchema = z.object({
  field: z.string().max(80),
  value: z.string().max(2000),
  source: sourceSchema,
});
export const deploymentSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  kind: z.enum(["local", "remote"]),
  transport: z.enum(["stdio", "streamable-http", "sse"]),
  endpoint: httpsUrl.optional(),
  package: z
    .object({ registry: z.string(), name: z.string(), version: z.string() })
    .optional(),
  runtime: z.string().max(300),
  auth: z.enum(["none", "api-key", "oauth", "unknown"]),
  pricing: z.enum(["free", "freemium", "paid", "unknown"]),
  restrictedRead: z.enum(["yes", "no", "unknown"]),
  source: sourceSchema,
});
export const profileSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(80),
  registryName: z.string().max(200),
  name: z.string().max(120),
  publisher: z.string().max(200),
  description: z.string().max(2000),
  category: z.enum(["documentation", "repositories", "research", "projects"]),
  tasks: z.array(z.string().max(150)).max(20),
  documentation: httpsUrl,
  repository: httpsUrl.optional(),
  version: z.string().max(150),
  collectedAt: z.string().datetime(),
  deployments: z.array(deploymentSchema).min(1).max(10),
  tools: z
    .array(
      z.object({
        name: z.string().max(150),
        description: z.string().max(1500),
        source: sourceSchema,
      }),
    )
    .max(100),
  claims: z.array(claimSchema).max(50),
  unknowns: z.array(z.string().max(1000)).max(30),
  published: z.boolean().default(true),
});
export type Profile = z.infer<typeof profileSchema>;
export type Deployment = z.infer<typeof deploymentSchema>;
export type Verification = {
  id: string;
  profile_id: string;
  deployment_id: string;
  target: string;
  version: string;
  started_at: string;
  duration_ms: number;
  outcome: "tools-listed" | "initialized" | "auth-required" | "failed";
  fingerprint: string | null;
  findings: string;
  tools?: unknown[];
};
export const filterSchema = z.object({
  category: z
    .enum(["documentation", "repositories", "research", "projects"])
    .optional(),
  setup: z.enum(["local", "remote"]).optional(),
  auth: z.enum(["none", "api-key", "oauth"]).optional(),
  pricing: z.enum(["free", "freemium", "paid"]).optional(),
  verification: z
    .enum([
      "tools-listed",
      "initialized",
      "auth-required",
      "failed",
      "not-tested",
      "stale",
    ])
    .optional(),
  restrictedRead: z.boolean().optional(),
  includeUnknown: z.boolean().default(false),
});
export const searchSchema = z.object({
  query: z.string().max(240).default(""),
  filters: filterSchema.default({ includeUnknown: false }),
  page: z.number().int().min(1).max(100).default(1),
  limit: z.number().int().min(1).max(20).default(10),
  autoConstraints: z.boolean().default(true),
});
export type Filters = z.infer<typeof filterSchema>;
