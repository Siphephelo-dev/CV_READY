/**
 * Local chat simulator: talk to the bot in your terminal, no WhatsApp, Redis or Supabase needed.
 *   npm run chat
 * Type a number to tap a button / pick a list row. Type /state to see the session, /quit to exit.
 */
import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { Engine } from "../bot/engine.js";
import type { Outgoing } from "../bot/types.js";
import { MemoryCvRepository } from "../store/memory-repository.js";
import { MemorySessionStore } from "../store/session-store.js";
import type { MessageSender } from "../whatsapp/client.js";
import type { InboundInput } from "../whatsapp/parse.js";

const WA_ID = "27721234567";
let options: Array<{ id: string; title: string; kind: "button" | "list" }> = [];

const sender: MessageSender = {
  async send(_to, m: Outgoing) {
    console.log("\n\x1b[32m🤖 CV Ready\x1b[0m");
    console.log(m.body.replace(/\*(.+?)\*/g, "\x1b[1m$1\x1b[0m"));
    if (m.type === "buttons") {
      options = m.buttons.map((b) => ({ ...b, kind: "button" }));
      options.forEach((o, i) => console.log(`   [${i + 1}] ${o.title}`));
    } else if (m.type === "list") {
      options = m.rows.map((r) => ({ id: r.id, title: r.title, kind: "list" }));
      console.log(`   ☰ ${m.button}`);
      options.forEach((o, i) => console.log(`   [${i + 1}] ${o.title}`));
    } else {
      options = [];
    }
  },
  async markRead() {},
};

const sessions = new MemorySessionStore();
const repo = new MemoryCvRepository();
const engine = new Engine({ sessions, repo, sender, consentVersion: "dev" });
const rl = createInterface({ input, output });
let n = 0;

console.log("CV Ready simulator. Say hi! (/state, /db, /voice, /quit)");
rl.setPrompt("\n\x1b[36m🧑 You:\x1b[0m ");
rl.prompt();
for await (const raw of rl) {
  const line = raw.trim();
  if (line === "/quit") break;
  if (line === "/state") console.dir(await sessions.get(WA_ID), { depth: null });
  else if (line === "/db") console.dir(await repo.load(WA_ID), { depth: null });
  else {
    let msgInput: InboundInput = { kind: "text", text: line };
    const picked = /^\d+$/.test(line) ? options[Number(line) - 1] : undefined;
    if (picked) msgInput = { kind: picked.kind, id: picked.id, title: picked.title };
    if (line === "/voice") msgInput = { kind: "audio" };
    if (!input.isTTY) console.log(line); // echo when input is piped
    await engine.handle({ id: `local-${++n}`, from: WA_ID, timestamp: Date.now(), input: msgInput });
  }
  rl.prompt();
}
rl.close();
