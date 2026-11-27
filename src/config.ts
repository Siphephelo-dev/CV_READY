import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.string().default("info"),

  WHATSAPP_TOKEN: z.string().min(1),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
  WHATSAPP_VERIFY_TOKEN: z.string().min(8),
  WHATSAPP_APP_SECRET: z.string().optional(),
  GRAPH_API_VERSION: z.string().default("v26.0"),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  REDIS_URL: z.string().default("redis://localhost:6379"),
  CONSENT_VERSION: z.string().default("2026-11-v1"),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}\nCopy .env.example to .env and fill it in.`);
  }
  const cfg = parsed.data;
  if (cfg.NODE_ENV === "production" && !cfg.WHATSAPP_APP_SECRET) {
    throw new Error("WHATSAPP_APP_SECRET is required in production (webhook signature verification).");
  }
  return cfg;
}
