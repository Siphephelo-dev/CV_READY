/**
 * Turns Meta's nested webhook payload into flat, typed inbound messages.
 * Only the fields we use are typed; everything else is ignored.
 */

export type InboundInput =
  | { kind: "text"; text: string }
  | { kind: "button"; id: string; title: string }
  | { kind: "list"; id: string; title: string }
  | { kind: "audio" }
  | { kind: "unsupported"; type: string };

export interface InboundMessage {
  id: string; // wamid.* — used for de-duplication and read receipts
  from: string; // sender's WhatsApp ID (phone number, digits only)
  profileName?: string;
  timestamp: number;
  input: InboundInput;
}

interface RawMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  interactive?: {
    type: "button_reply" | "list_reply" | "nfm_reply";
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
  button?: { text: string; payload: string };
}

interface RawWebhook {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
        messages?: RawMessage[];
      };
    }>;
  }>;
}

export function parseWebhook(body: unknown): InboundMessage[] {
  const payload = body as RawWebhook;
  if (payload?.object !== "whatsapp_business_account") return [];
  const out: InboundMessage[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages" || !change.value?.messages) continue; // statuses etc. are ignored
      const names = new Map((change.value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]));
      for (const m of change.value.messages) {
        out.push({
          id: m.id,
          from: m.from,
          profileName: names.get(m.from),
          timestamp: Number(m.timestamp) || 0,
          input: toInput(m),
        });
      }
    }
  }
  return out;
}

function toInput(m: RawMessage): InboundInput {
  switch (m.type) {
    case "text":
      return { kind: "text", text: m.text?.body ?? "" };
    case "interactive":
      if (m.interactive?.button_reply) return { kind: "button", ...m.interactive.button_reply };
      if (m.interactive?.list_reply) return { kind: "list", ...m.interactive.list_reply };
      return { kind: "unsupported", type: `interactive:${m.interactive?.type}` };
    case "button": // quick-reply button on a template message
      return { kind: "button", id: m.button?.payload ?? "", title: m.button?.text ?? "" };
    case "audio":
      return { kind: "audio" };
    default:
      return { kind: "unsupported", type: m.type };
  }
}
