import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { parseWebhook, type InboundMessage } from "./whatsapp/parse.js";
import { isValidSignature } from "./whatsapp/signature.js";

export interface ServerOptions {
  verifyToken: string;
  /** If set, every POST must carry a valid X-Hub-Signature-256. Always set this in production. */
  appSecret?: string;
  handleMessage: (msg: InboundMessage) => Promise<void>;
  logger?: FastifyServerOptions["logger"];
}

/**
 * HTTP layer. Meta expects a 200 within a few seconds or it retries, so we acknowledge immediately
 * and process messages in the background. `drain()` waits for in-flight work (tests, graceful shutdown).
 */
export function buildServer(opts: ServerOptions): { app: FastifyInstance; drain: () => Promise<void> } {
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 1024 * 1024 });
  const inflight = new Set<Promise<void>>();

  // Keep the raw bytes: the signature is computed over the exact body Meta sent.
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => {
    try {
      const raw = body as Buffer;
      done(null, { raw, json: raw.length ? JSON.parse(raw.toString("utf8")) : {} });
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  app.get("/health", async () => ({ ok: true }));

  // Step 1 of webhook setup: Meta calls this once to check you own the URL.
  app.get("/webhook", async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    if (q["hub.mode"] === "subscribe" && q["hub.verify_token"] === opts.verifyToken && q["hub.challenge"]) {
      return reply.type("text/plain").send(q["hub.challenge"]);
    }
    return reply.code(403).send("Forbidden");
  });

  // Step 2: every incoming message / status update arrives here.
  app.post("/webhook", async (req, reply) => {
    const body = req.body as { raw: Buffer; json: unknown } | undefined;
    if (!body) return reply.code(400).send();
    if (opts.appSecret) {
      const sig = req.headers["x-hub-signature-256"];
      if (!isValidSignature(body.raw, Array.isArray(sig) ? sig[0] : sig, opts.appSecret)) {
        req.log.warn("webhook signature mismatch");
        return reply.code(401).send();
      }
    }

    for (const msg of parseWebhook(body.json)) {
      const job = opts
        .handleMessage(msg)
        .catch((err) => req.log.error({ err, from: msg.from, id: msg.id }, "failed to handle message"))
        .finally(() => inflight.delete(job));
      inflight.add(job);
    }
    return reply.code(200).send();
  });

  const drain = async () => {
    while (inflight.size) await Promise.allSettled([...inflight]);
  };
  app.addHook("onClose", drain);

  return { app, drain };
}
