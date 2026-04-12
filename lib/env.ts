import { z } from "zod";

// Public env — validated in both browser and server contexts.
// Only NEXT_PUBLIC_* vars belong here: Next.js inlines these at build time,
// so they exist in the client bundle. Server-only vars live in `lib/env.server.ts`.
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

const parsed = publicSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});

if (!parsed.success) {
  console.error("❌ Invalid public environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid public environment variables — see lib/env.ts");
}

export const env = parsed.data;
