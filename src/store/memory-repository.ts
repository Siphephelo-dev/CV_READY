import { randomUUID } from "node:crypto";
import { emptyDraft, type CvDraft, type Section, type UiLang } from "../bot/types.js";
import type { CvRepository, StoredCv } from "./cv-repository.js";

/** In-memory CvRepository for tests and the local chat simulator. */
export class MemoryCvRepository implements CvRepository {
  readonly users = new Map<string, StoredCv & { waId: string; consentVersion: string }>();
  readonly deletions: string[] = [];

  private byId(userId: string) {
    for (const u of this.users.values()) if (u.userId === userId) return u;
    throw new Error(`No user ${userId}`);
  }

  async recordConsent(waId: string, preferredLanguage: string | undefined, uiLanguage: UiLang, consentVersion: string) {
    const existing = this.users.get(waId);
    const userId = existing?.userId ?? randomUUID();
    this.users.set(waId, {
      waId,
      userId,
      preferredLanguage: preferredLanguage ?? null,
      uiLanguage,
      completed: existing?.completed ?? false,
      draft: existing?.draft ?? emptyDraft(),
      consentVersion,
    });
    return userId;
  }

  async saveLanguage(userId: string, preferredLanguage: string | undefined, uiLanguage: UiLang) {
    const u = this.byId(userId);
    u.preferredLanguage = preferredLanguage ?? null;
    u.uiLanguage = uiLanguage;
  }

  async saveSection(userId: string, section: Section, draft: CvDraft) {
    const u = this.byId(userId);
    const copy = structuredClone(draft);
    if (section === "references") {
      u.draft.references = copy.references;
      u.draft.referencesOnRequest = copy.referencesOnRequest;
    } else {
      (u.draft as unknown as Record<Section, unknown>)[section] = copy[section];
    }
  }

  async markCompleted(userId: string) {
    this.byId(userId).completed = true;
  }

  async load(waId: string) {
    const u = this.users.get(waId);
    return u ? structuredClone(u) : null;
  }

  async deleteUser(waId: string) {
    this.users.delete(waId);
    this.deletions.push(waId);
  }
}
