import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildServer } from "../src/server.js";
import { toCloudPayload } from "../src/whatsapp/client.js";
import type { InboundMessage } from "../src/whatsapp/parse.js";
import { parseWebhook } from "../src/whatsapp/parse.js";
import { cleanSaPhone, cleanName, parseYear } from "../src/bot/validate.js";

const SECRET = "test-app-secret";
const sign = (body: string) => "sha256=" + createHmac("sha256", SECRET).update(body).digest("hex");

const sample = (text: string) =>
  JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              contacts: [{ wa_id: "27721234567", profile: { name: "Thabo" } }],
              messages: [{ id: "wamid.1", from: "27721234567", timestamp: "1700000000", type: "text", text: { body: text } }],
            },
          },
        ],
      },
    ],
  });

function setup() {
  const received: InboundMessage[] = [];
  const { app, drain } = buildServer({
    verifyToken: "verify-me-please",
    appSecret: SECRET,
    handleMessage: async (m) => {
      received.push(m);
    },
  });
  return { app, drain, received };
}

describe("webhook", () => {
  it("answers Meta's verification challenge only with the right token", async () => {
    const { app } = setup();
    const ok = await app.inject({ method: "GET", url: "/webhook?hub.mode=subscribe&hub.verify_token=verify-me-please&hub.challenge=42" });
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toBe("42");
    const bad = await app.inject({ method: "GET", url: "/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=42" });
    expect(bad.statusCode).toBe(403);
  });

  it("accepts correctly signed messages and passes them on", async () => {
    const { app, drain, received } = setup();
    const body = sample("Hi");
    const res = await app.inject({
      method: "POST",
      url: "/webhook",
      payload: body,
      headers: { "content-type": "application/json", "x-hub-signature-256": sign(body) },
    });
    expect(res.statusCode).toBe(200);
    await drain();
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ from: "27721234567", profileName: "Thabo", input: { kind: "text", text: "Hi" } });
  });

  it("rejects bad signatures", async () => {
    const { app, received } = setup();
    const res = await app.inject({
      method: "POST",
      url: "/webhook",
      payload: sample("Hi"),
      headers: { "content-type": "application/json", "x-hub-signature-256": sign("something else") },
    });
    expect(res.statusCode).toBe(401);
    expect(received).toHaveLength(0);
  });

  it("parses button and list replies, and ignores status updates", () => {
    const wrap = (value: object) => ({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value }] }] });
    const btn = parseWebhook(
      wrap({ messages: [{ id: "a", from: "1", timestamp: "1", type: "interactive", interactive: { type: "button_reply", button_reply: { id: "consent:yes", title: "✅ I agree" } } }] }),
    );
    expect(btn[0]?.input).toEqual({ kind: "button", id: "consent:yes", title: "✅ I agree" });
    expect(parseWebhook(wrap({ statuses: [{ id: "x", status: "delivered" }] }))).toEqual([]);
  });
});

describe("outgoing payloads", () => {
  it("clips button titles to WhatsApp's 20-character limit", () => {
    const p = toCloudPayload("27", { type: "buttons", body: "Pick", buttons: [{ id: "a", title: "This title is far too long for WhatsApp" }] }) as any;
    expect(p.interactive.action.buttons[0].reply.title.length).toBeLessThanOrEqual(20);
  });

  it("refuses more than 3 buttons", () => {
    const buttons = [1, 2, 3, 4].map((i) => ({ id: `${i}`, title: `${i}` }));
    expect(() => toCloudPayload("27", { type: "buttons", body: "x", buttons })).toThrow();
  });
});

describe("validators", () => {
  it("normalises SA phone numbers", () => {
    expect(cleanSaPhone("072 123 4567")).toBe("+27721234567");
    expect(cleanSaPhone("+27 72 123 4567")).toBe("+27721234567");
    expect(cleanSaPhone("12345")).toBeNull();
  });
  it("title-cases names typed in one case, keeps mixed case", () => {
    expect(cleanName("thabo")).toBe("Thabo");
    expect(cleanName("MOKOENA")).toBe("Mokoena");
    expect(cleanName("van der Merwe")).toBe("van der Merwe");
    expect(cleanName("1234")).toBeNull();
  });
  it("finds a year in free text", () => {
    expect(parseYear("I finished in 2021")).toBe(2021);
    expect(parseYear("last year")).toBeNull();
  });
});
