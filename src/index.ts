import { createClient } from "@supabase/supabase-js";
import { Redis } from "ioredis";
import { loadConfig } from "./config.js";
import { Engine } from "./bot/engine.js";
import { buildServer } from "./server.js";
import { RedisSessionStore } from "./store/session-store.js";
import { SupabaseCvRepository } from "./store/supabase-repository.js";
import { CloudApiClient } from "./whatsapp/client.js";

const cfg = loadConfig();

const redis = new Redis(cfg.REDIS_URL, { maxRetriesPerRequest: 3 });
const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { app } = buildServer({
  verifyToken: cfg.WHATSAPP_VERIFY_TOKEN,
  appSecret: cfg.WHATSAPP_APP_SECRET,
  logger: { level: cfg.LOG_LEVEL },
  handleMessage: (msg) => engine.handle(msg),
});

const engine = new Engine({
  sessions: new RedisSessionStore(redis),
  repo: new SupabaseCvRepository(supabase),
  sender: new CloudApiClient({
    token: cfg.WHATSAPP_TOKEN,
    phoneNumberId: cfg.WHATSAPP_PHONE_NUMBER_ID,
    apiVersion: cfg.GRAPH_API_VERSION,
  }),
  consentVersion: cfg.CONSENT_VERSION,
  log: app.log,
});

const shutdown = async (signal: string) => {
  app.log.info(`${signal} received, shutting down`);
  await app.close(); // waits for in-flight messages
  redis.disconnect();
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await app.listen({ port: cfg.PORT, host: "0.0.0.0" });
