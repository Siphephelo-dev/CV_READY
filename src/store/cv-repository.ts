import type { CvDraft, Section, UiLang } from "../bot/types.js";

/** What we need to rebuild a session if Redis forgot it (TTL expired, Redis restarted). */
export interface StoredCv {
  userId: string;
  preferredLanguage: string | null;
  uiLanguage: UiLang;
  completed: boolean;
  draft: CvDraft;
}

/** Durable storage for users and their CV sections. Supabase in production, memory in tests. */
export interface CvRepository {
  /** Creates the user if needed and records their consent. Returns the user id. */
  recordConsent(waId: string, preferredLanguage: string | undefined, uiLanguage: UiLang, consentVersion: string): Promise<string>;
  saveLanguage(userId: string, preferredLanguage: string | undefined, uiLanguage: UiLang): Promise<void>;
  /** Replaces one section of the CV with what's in the draft. */
  saveSection(userId: string, section: Section, draft: CvDraft): Promise<void>;
  markCompleted(userId: string): Promise<void>;
  load(waId: string): Promise<StoredCv | null>;
  /** Hard delete of the user and everything linked to them (POPIA right to erasure). */
  deleteUser(waId: string): Promise<void>;
}
