import { filterSchema } from "./types";
export function searchFromParams(
  s: Record<string, string | string[] | undefined>,
) {
  const v = (k: string) =>
    typeof s[k] === "string" ? (s[k] as string) : undefined;
  return {
    query: v("q") ?? "",
    page: Number(v("page") ?? 1),
    autoConstraints: v("auto") !== "off",
    filters: filterSchema.parse({
      category: v("category") || undefined,
      setup: v("setup") || undefined,
      auth: v("auth") || undefined,
      pricing: v("pricing") || undefined,
      verification: v("verification") || undefined,
      restrictedRead: v("restrictedRead") === "true" ? true : undefined,
      includeUnknown: v("includeUnknown") === "true",
    }),
  };
}
