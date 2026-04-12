import "server-only";
import { z } from "zod";

// Server-only env. Importing this from client code fails the build
// because of `server-only`. Keep secrets here.
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const parsed = serverSchema.safeParse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

if (!parsed.success) {
  console.error("❌ Invalid server environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid server environment variables — see lib/env.server.ts");
}

export const serverEnv = parsed.data;
