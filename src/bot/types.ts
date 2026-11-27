import type { InboundInput } from "../whatsapp/parse.js";

export type { InboundInput };

/** Languages the bot can actually speak. Others fall back to English (and are still recorded). */
export type UiLang = "en" | "zu";

export type State =
  | "LANGUAGE"
  | "CONSENT"
  // personal details
  | "DETAILS_FIRST_NAME"
  | "DETAILS_SURNAME"
  | "DETAILS_AREA"
  | "DETAILS_EMAIL"
  // education
  | "EDU_MATRIC"
  | "EDU_SCHOOL"
  | "EDU_YEAR"
  | "EDU_HIGHEST_GRADE"
  | "EDU_MORE"
  | "EDU_EXTRA_NAME"
  | "EDU_EXTRA_YEAR"
  // experience
  | "EXP_HAS"
  | "EXP_TITLE"
  | "EXP_PLACE"
  | "EXP_DATES"
  | "EXP_DESCRIPTION"
  | "EXP_MORE"
  // skills
  | "SKILLS"
  // references
  | "REF_ASK"
  | "REF_NAME"
  | "REF_PHONE"
  | "REF_RELATION"
  | "REF_MORE"
  // after the flow
  | "REVIEW"
  | "EDIT_MENU"
  | "DELETE_CONFIRM";

export type Section = "details" | "education" | "experience" | "skills" | "references";
export const SECTION_ORDER: Section[] = ["details", "education", "experience", "skills", "references"];

export interface Details {
  firstName?: string;
  surname?: string;
  area?: string;
  email?: string | null;
}

export type MatricStatus = "completed" | "studying" | "not_completed";

export interface Education {
  matric?: MatricStatus;
  school?: string;
  year?: number;
  highestGrade?: string;
  extras: Array<{ name: string; year?: number }>;
}

export interface Experience {
  title: string;
  place: string;
  dates: string;
  description: string;
}

export interface Reference {
  name: string;
  phone: string;
  relationship: string;
}

export interface CvDraft {
  details: Details;
  education: Education;
  experience: Experience[];
  skills: string[];
  references: Reference[];
  referencesOnRequest: boolean;
}

export interface Session {
  waId: string;
  userId?: string; // set once the user has consented and exists in the database
  preferredLanguage?: string; // what they picked, e.g. "st" (Sesotho)
  lang: UiLang; // what we can actually reply in
  state: State;
  draft: CvDraft;
  /** Item being collected right now (one job, one reference, one certificate). */
  scratch: Record<string, string | undefined>;
  /** True when the user came in via EDIT: finishing the section returns to REVIEW. */
  editing: boolean;
  /** Where to go back to if the user cancels a DELETE. */
  stateBeforeDelete?: State;
}

/** Channel-neutral reply. The WhatsApp client turns it into the Cloud API format. */
export type Outgoing =
  | { type: "text"; body: string }
  | { type: "buttons"; body: string; buttons: Array<{ id: string; title: string }> }
  | { type: "list"; body: string; button: string; rows: Array<{ id: string; title: string; description?: string }> };

/** Side effects the engine performs after a step, so the state machine itself stays pure and testable. */
export type Effect =
  | { type: "consent" }
  | { type: "saveLanguage" }
  | { type: "saveSection"; section: Section }
  | { type: "completed" }
  | { type: "deleteUser"; waId: string };

export interface StepResult {
  /** null means "forget this user" (after DELETE). */
  session: Session | null;
  replies: Outgoing[];
  effects: Effect[];
}

export function emptyDraft(): CvDraft {
  return {
    details: {},
    education: { extras: [] },
    experience: [],
    skills: [],
    references: [],
    referencesOnRequest: false,
  };
}

export function newSession(waId: string): Session {
  return { waId, lang: "en", state: "LANGUAGE", draft: emptyDraft(), scratch: {}, editing: false };
}
