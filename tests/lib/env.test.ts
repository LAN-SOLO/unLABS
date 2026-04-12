import { describe, it, expect } from "vitest";
import { z } from "zod";

// Mirrors the schema in lib/env.ts. We re-declare it here so the test
// can exercise rejection paths without triggering the module's import-time
// throw on bad real env vars.
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

describe("public env schema", () => {
  it("accepts a valid config", () => {
    const result = publicSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-URL supabase url", () => {
    const result = publicSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing anon key", () => {
    const result = publicSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    });
    expect(result.success).toBe(false);
  });
});
