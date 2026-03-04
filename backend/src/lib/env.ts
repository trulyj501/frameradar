import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z
    .string()
    .default("4000")
    .transform((value) => Number.parseInt(value, 10))
    .pipe(z.number().int().positive()),
  FRONTEND_ORIGIN: z.string().default("http://localhost:5173"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().default("gemini-2.5-pro")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid environment configuration:\n${details}`);
}

const hasPlaceholderSupabaseConfig =
  parsed.data.SUPABASE_URL.includes("your-project.supabase.co") ||
  parsed.data.SUPABASE_ANON_KEY === "your_anon_key" ||
  parsed.data.SUPABASE_SERVICE_ROLE_KEY === "your_service_role_key";

if (hasPlaceholderSupabaseConfig) {
  throw new Error(
    "Supabase environment variables are still placeholders. Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in backend/.env."
  );
}

export const env = parsed.data;
