import type { Outgoing } from "../bot/types.js";

/** Anything that can deliver bot replies: the real Cloud API, the console simulator, or a test fake. */
export interface MessageSender {
  send(to: string, message: Outgoing): Promise<void>;
  markRead(messageId: string): Promise<void>;
}

// WhatsApp limits for interactive messages. Exceeding them makes the API reject the message.
const MAX_BUTTONS = 3;
const MAX_BUTTON_TITLE = 20;
const MAX_ROWS = 10;
const MAX_ROW_TITLE = 24;
const MAX_ROW_DESC = 72;
const MAX_BODY = 1024;

const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1) + "…");

/** Converts our channel-neutral Outgoing message into a Cloud API /messages payload. */
export function toCloudPayload(to: string, m: Outgoing): Record<string, unknown> {
  const base = { messaging_product: "whatsapp", recipient_type: "individual", to };
  switch (m.type) {
    case "text":
      return { ...base, type: "text", text: { body: m.body, preview_url: false } };
    case "buttons":
      if (m.buttons.length > MAX_BUTTONS) throw new Error(`Max ${MAX_BUTTONS} buttons, got ${m.buttons.length}`);
      return {
        ...base,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: clip(m.body, MAX_BODY) },
          action: {
            buttons: m.buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: clip(b.title, MAX_BUTTON_TITLE) } })),
          },
        },
      };
    case "list":
      if (m.rows.length > MAX_ROWS) throw new Error(`Max ${MAX_ROWS} list rows, got ${m.rows.length}`);
      return {
        ...base,
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: clip(m.body, 4096) },
          action: {
            button: clip(m.button, MAX_BUTTON_TITLE),
            sections: [
              {
                rows: m.rows.map((r) => ({
                  id: r.id,
                  title: clip(r.title, MAX_ROW_TITLE),
                  ...(r.description ? { description: clip(r.description, MAX_ROW_DESC) } : {}),
                })),
              },
            ],
          },
        },
      };
  }
}

export class CloudApiClient implements MessageSender {
  constructor(
    private readonly opts: { token: string; phoneNumberId: string; apiVersion: string; fetchImpl?: typeof fetch },
  ) {}

  private get url() {
    return `https://graph.facebook.com/${this.opts.apiVersion}/${this.opts.phoneNumberId}/messages`;
  }

  private async post(body: Record<string, unknown>): Promise<void> {
    const res = await (this.opts.fetchImpl ?? fetch)(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.opts.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`WhatsApp API ${res.status}: ${text}`);
    }
  }

  send(to: string, message: Outgoing): Promise<void> {
    return this.post(toCloudPayload(to, message));
  }

  markRead(messageId: string): Promise<void> {
    return this.post({ messaging_product: "whatsapp", status: "read", message_id: messageId });
  }
}
