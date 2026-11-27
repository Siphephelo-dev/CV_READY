import type { InboundMessage } from "../whatsapp/parse.js";
import type { MessageSender } from "../whatsapp/client.js";
import type { SessionStore } from "../store/session-store.js";
import type { CvRepository } from "../store/cv-repository.js";
import { step } from "./machine.js";
import type { Session, StepResult } from "./types.js";

export interface Logger {
  info(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

export interface EngineDeps {
  sessions: SessionStore;
  repo: CvRepository;
  sender: MessageSender;
  consentVersion: string;
  log?: Logger;
}

/**
 * Glue between WhatsApp, the pure state machine and storage. For each inbound message:
 *   1. drop duplicates (Meta retries webhooks)
 *   2. lock the user so their messages are handled one at a time, in order
 *   3. load the session (Redis → else rebuild from Supabase → else new)
 *   4. run the state machine
 *   5. apply side effects (database writes)        ← before replying, so we never confirm unsaved data
 *   6. save/delete the session, then send replies
 */
export class Engine {
  constructor(private readonly deps: EngineDeps) {}

  async handle(msg: InboundMessage): Promise<void> {
    const { sessions, sender, log } = this.deps;
    if (!(await sessions.markSeen(msg.id))) {
      log?.info({ id: msg.id }, "duplicate message ignored");
      return;
    }

    await sessions.withLock(msg.from, async () => {
      const session = await this.loadSession(msg.from);
      const result = step(session, msg.from, msg.input);
      await this.applyEffects(result);

      if (result.session) await sessions.save(result.session);
      else await sessions.delete(msg.from);

      await sender.markRead(msg.id).catch((err) => log?.error({ err }, "markRead failed"));
      for (const reply of result.replies) await sender.send(msg.from, reply);
    });
  }

  /** Redis is a cache of the conversation. If it's gone, rebuild from the durable copy. */
  private async loadSession(waId: string): Promise<Session | null> {
    const cached = await this.deps.sessions.get(waId);
    if (cached) return cached;
    const stored = await this.deps.repo.load(waId);
    if (!stored) return null;
    return {
      waId,
      userId: stored.userId,
      preferredLanguage: stored.preferredLanguage ?? undefined,
      lang: stored.uiLanguage,
      // If they never finished, the simplest safe option is to show the review screen; EDIT takes them anywhere.
      state: "REVIEW",
      draft: stored.draft,
      scratch: {},
      editing: false,
    };
  }

  private async applyEffects(result: StepResult): Promise<void> {
    const { repo, consentVersion } = this.deps;
    const s = result.session;
    for (const effect of result.effects) {
      switch (effect.type) {
        case "consent":
          if (s) s.userId = await repo.recordConsent(s.waId, s.preferredLanguage, s.lang, consentVersion);
          break;
        case "saveLanguage":
          if (s?.userId) await repo.saveLanguage(s.userId, s.preferredLanguage, s.lang);
          break;
        case "saveSection":
          if (s?.userId) await repo.saveSection(s.userId, effect.section, s.draft);
          break;
        case "completed":
          if (s?.userId) await repo.markCompleted(s.userId);
          break;
        case "deleteUser":
          await repo.deleteUser(effect.waId);
          break;
      }
    }
  }
}
