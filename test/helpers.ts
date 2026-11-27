import { Engine } from "../src/bot/engine.js";
import type { Outgoing } from "../src/bot/types.js";
import { MemoryCvRepository } from "../src/store/memory-repository.js";
import { MemorySessionStore } from "../src/store/session-store.js";
import type { MessageSender } from "../src/whatsapp/client.js";
import type { InboundInput } from "../src/whatsapp/parse.js";

export const WA_ID = "27721234567";

/** Drives the real Engine with in-memory stores and records everything the bot sends. */
export function harness() {
  const sent: Outgoing[] = [];
  const sender: MessageSender = {
    async send(_to, m) {
      sent.push(m);
    },
    async markRead() {},
  };
  const sessions = new MemorySessionStore();
  const repo = new MemoryCvRepository();
  const engine = new Engine({ sessions, repo, sender, consentVersion: "test-v1" });
  let n = 0;

  const send = async (input: InboundInput) => {
    const before = sent.length;
    await engine.handle({ id: `m${++n}`, from: WA_ID, timestamp: 0, input });
    return sent.slice(before);
  };

  return {
    sent,
    sessions,
    repo,
    engine,
    text: (text: string) => send({ kind: "text", text }),
    tap: (id: string) => send({ kind: "button", id, title: id }),
    pick: (id: string) => send({ kind: "list", id, title: id }),
    raw: send,
    state: async () => (await sessions.get(WA_ID))?.state,
    last: () => sent.at(-1)!,
  };
}

/** Runs the whole happy path up to the review screen. */
export async function completeFlow(h: ReturnType<typeof harness>, lang = "lang:en") {
  await h.text("Hi");
  await h.pick(lang);
  await h.tap("consent:yes");
  await h.text("thabo");
  await h.text("MOKOENA");
  await h.text("Soweto, Gauteng");
  await h.tap("email:skip");
  await h.tap("matric:completed");
  await h.text("Morris Isaacson High");
  await h.text("2021");
  await h.tap("more:add");
  await h.text("First Aid Level 1");
  await h.text("2023");
  await h.tap("more:done");
  await h.tap("exp:yes");
  await h.text("Car wash attendant");
  await h.text("Maponya Mall, Soweto");
  await h.text("2023 - 2025");
  await h.text("I washed cars and took cash from customers");
  await h.tap("more:done");
  await h.text("customer service, cash handling, Teamwork");
  await h.tap("ref:add");
  await h.text("Sipho Dlamini");
  await h.text("082 555 1234");
  await h.text("Former manager");
  await h.tap("more:done");
}
