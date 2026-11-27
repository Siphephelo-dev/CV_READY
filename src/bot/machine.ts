/**
 * The conversation state machine.
 *
 * `step()` is a PURE function: (session, input) → (new session, replies, effects).
 * It never touches the network, Redis or the database. The engine (engine.ts) does that afterwards
 * by applying the returned effects. This makes the whole conversation easy to unit test.
 *
 * Flow: LANGUAGE → CONSENT → details → education → experience → skills → references → REVIEW
 * Commands (any time): DELETE, EDIT, RESTART, HELP (+ isiZulu equivalents, see i18n.ts)
 */
import { COMMANDS, LANGUAGES, t, type MsgKey } from "./i18n.js";
import {
  emptyDraft,
  newSession,
  SECTION_ORDER,
  type Effect,
  type InboundInput,
  type Outgoing,
  type Section,
  type Session,
  type State,
  type StepResult,
} from "./types.js";
import { renderSummary } from "./summary.js";
import {
  cleanDates,
  cleanEmail,
  cleanLongText,
  cleanName,
  cleanSaPhone,
  cleanText,
  parseSkills,
  parseYear,
} from "./validate.js";

export const LIMITS = { experience: 5, references: 2, extras: 5 } as const;

const SECTION_START: Record<Section, State> = {
  details: "DETAILS_FIRST_NAME",
  education: "EDU_MATRIC",
  experience: "EXP_HAS",
  skills: "SKILLS",
  references: "REF_ASK",
};

// ---------------------------------------------------------------------------
// Prompts: what the bot says when it enters each state (also used to re-ask)
// ---------------------------------------------------------------------------

function text(body: string): Outgoing {
  return { type: "text", body };
}

function buttons(s: Session, bodyKey: MsgKey, opts: Array<[id: string, key: MsgKey]>, vars = {}): Outgoing {
  return {
    type: "buttons",
    body: t(s.lang, bodyKey, vars),
    buttons: opts.map(([id, key]) => ({ id, title: t(s.lang, key) })),
  };
}

export function prompt(s: Session): Outgoing {
  const L = s.lang;
  switch (s.state) {
    case "LANGUAGE":
      return {
        type: "list",
        body: t(L, "welcome"),
        button: t(L, "btn_choose_language"),
        rows: LANGUAGES.map((l) => ({ id: `lang:${l.code}`, title: l.label })),
      };
    case "CONSENT":
      return buttons(s, "consent", [
        ["consent:yes", "btn_agree"],
        ["consent:more", "btn_read_more"],
        ["consent:no", "btn_no_thanks"],
      ]);
    case "DETAILS_FIRST_NAME":
      return text(t(L, "ask_first_name"));
    case "DETAILS_SURNAME":
      return text(t(L, "ask_surname"));
    case "DETAILS_AREA":
      return text(t(L, "ask_area"));
    case "DETAILS_EMAIL":
      return buttons(s, "ask_email", [["email:skip", "btn_skip"]]);
    case "EDU_MATRIC":
      return buttons(s, "ask_matric", [
        ["matric:completed", "btn_yes"],
        ["matric:studying", "btn_studying"],
        ["matric:not_completed", "btn_no"],
      ]);
    case "EDU_SCHOOL":
      return text(t(L, "ask_school"));
    case "EDU_YEAR":
      return text(t(L, s.draft.education.matric === "studying" ? "ask_year_studying" : "ask_year"));
    case "EDU_HIGHEST_GRADE":
      return text(t(L, "ask_highest_grade"));
    case "EDU_MORE":
      return buttons(s, "ask_extra", [
        ["more:add", "btn_add"],
        ["more:done", "btn_continue"],
      ]);
    case "EDU_EXTRA_NAME":
      return text(t(L, "ask_extra_name"));
    case "EDU_EXTRA_YEAR":
      return buttons(s, "ask_extra_year", [["year:skip", "btn_skip"]]);
    case "EXP_HAS":
      return buttons(s, "ask_exp_has", [
        ["exp:yes", "btn_yes"],
        ["exp:no", "btn_no"],
      ]);
    case "EXP_TITLE":
      return text(t(L, "ask_exp_title"));
    case "EXP_PLACE":
      return text(t(L, "ask_exp_place"));
    case "EXP_DATES":
      return text(t(L, "ask_exp_dates"));
    case "EXP_DESCRIPTION":
      return text(t(L, "ask_exp_description"));
    case "EXP_MORE":
      return buttons(
        s,
        "exp_saved",
        [
          ["more:add", "btn_add_another"],
          ["more:done", "btn_continue"],
        ],
        { title: s.draft.experience.at(-1)?.title ?? "" },
      );
    case "SKILLS":
      return text(t(L, "ask_skills"));
    case "REF_ASK":
      return buttons(s, "ask_refs", [
        ["ref:add", "btn_add_ref"],
        ["ref:on_request", "btn_on_request"],
      ]);
    case "REF_NAME":
      return text(t(L, "ask_ref_name"));
    case "REF_PHONE":
      return text(t(L, "ask_ref_phone"));
    case "REF_RELATION":
      return text(t(L, "ask_ref_relation"));
    case "REF_MORE":
      return buttons(
        s,
        "ref_saved",
        [
          ["more:add", "btn_add_another"],
          ["more:done", "btn_done"],
        ],
        { name: s.draft.references.at(-1)?.name ?? "" },
      );
    case "REVIEW":
      return text(`${t(L, "review_header", { name: s.draft.details.firstName ?? "" })}\n\n${renderSummary(s)}\n\n${t(L, "review_footer")}`);
    case "EDIT_MENU":
      return {
        type: "list",
        body: t(L, "edit_menu"),
        button: t(L, "btn_choose_section"),
        rows: [
          ...SECTION_ORDER.map((sec) => ({ id: `edit:${sec}`, title: t(L, `section_${sec}`) })),
          { id: "edit:language", title: t(L, "section_language") },
        ],
      };
    case "DELETE_CONFIRM":
      return buttons(s, "delete_confirm", [
        ["del:yes", "btn_delete_yes"],
        ["del:no", "btn_delete_no"],
      ]);
  }
}

// ---------------------------------------------------------------------------
// Input helpers
// ---------------------------------------------------------------------------

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * For button/list states: returns the chosen option id.
 * Also accepts typed answers that match an option's title ("yes", "Yebo") or its number ("1"),
 * because some phones/users type instead of tapping.
 */
function choiceOf(s: Session, input: InboundInput): string | null {
  if (input.kind === "button" || input.kind === "list") return input.id;
  if (input.kind !== "text") return null;
  const p = prompt(s);
  const options = p.type === "buttons" ? p.buttons : p.type === "list" ? p.rows : [];
  const typed = norm(input.text);
  if (!typed) return null;
  const byNumber = /^\d+$/.test(typed) ? options[Number(typed) - 1] : undefined;
  const byTitle = options.find((o) => norm(o.title) === typed);
  return (byNumber ?? byTitle)?.id ?? null;
}

const textOf = (input: InboundInput) => (input.kind === "text" ? input.text : null);

function commandOf(input: InboundInput) {
  if (input.kind !== "text") return null;
  return COMMANDS[norm(input.text)] ?? null;
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

class Step {
  replies: Outgoing[] = [];
  effects: Effect[] = [];
  constructor(public s: Session) {}

  say(key: MsgKey, vars?: Record<string, string | number>) {
    this.replies.push(text(t(this.s.lang, key, vars)));
    return this;
  }
  goto(state: State): StepResult {
    this.s.state = state;
    this.replies.push(prompt(this.s));
    return this.done();
  }
  /** Re-ask the current question, optionally after a hint. */
  retry(hint?: MsgKey): StepResult {
    if (hint) this.say(hint);
    return this.goto(this.s.state);
  }
  done(): StepResult {
    return { session: this.s, replies: this.replies, effects: this.effects };
  }
  forget(): StepResult {
    return { session: null, replies: this.replies, effects: this.effects };
  }

  startSection(section: Section, editing: boolean): StepResult {
    this.s.editing = editing;
    this.s.scratch = {};
    if (editing) {
      // EDIT replaces the whole section, so start it from empty.
      const fresh = emptyDraft();
      if (section === "references") {
        this.s.draft.references = [];
        this.s.draft.referencesOnRequest = false;
      } else {
        (this.s.draft as unknown as Record<Section, unknown>)[section] = fresh[section];
      }
    }
    return this.goto(SECTION_START[section]);
  }

  finishSection(section: Section): StepResult {
    this.s.scratch = {};
    this.effects.push({ type: "saveSection", section });
    if (this.s.editing) {
      this.s.editing = false;
      return this.goto("REVIEW");
    }
    const next = SECTION_ORDER[SECTION_ORDER.indexOf(section) + 1];
    if (next) return this.startSection(next, false);
    this.effects.push({ type: "completed" });
    return this.goto("REVIEW");
  }
}

export function step(current: Session | null, waId: string, input: InboundInput): StepResult {
  // First contact (or after DELETE): whatever they said, show the language menu.
  if (!current) return new Step(newSession(waId)).goto("LANGUAGE");

  const s: Session = structuredClone(current);
  const st = new Step(s);

  // ---- Global commands ----
  const cmd = commandOf(input);
  if (cmd === "HELP") {
    st.say("help");
    return st.retry();
  }
  if (cmd === "DELETE") {
    if (!s.userId) {
      st.say("deleted"); // nothing stored yet; just forget the session
      return st.forget();
    }
    if (s.state !== "DELETE_CONFIRM") s.stateBeforeDelete = s.state;
    return st.goto("DELETE_CONFIRM");
  }
  if (cmd === "EDIT") {
    if (!s.userId) return st.retry("need_consent_first");
    return st.goto("EDIT_MENU");
  }
  if (cmd === "RESTART") {
    if (!s.userId) return new Step(newSession(waId)).goto("LANGUAGE");
    s.draft = emptyDraft();
    st.say("restarting");
    return st.startSection("details", false);
  }

  // ---- Non-text inputs ----
  if (input.kind === "audio") return st.retry("voice_not_yet");
  if (input.kind === "unsupported") return st.retry("unsupported");

  // ---- State handlers ----
  const d = s.draft;
  const choice = () => choiceOf(s, input);
  const typed = textOf(input);

  switch (s.state) {
    case "LANGUAGE": {
      const id = choice();
      const lang = LANGUAGES.find((l) => `lang:${l.code}` === id);
      if (!lang) return typed?.trim() && !id ? st.goto("LANGUAGE") : st.retry("use_buttons");
      s.preferredLanguage = lang.code;
      s.lang = lang.ui;
      if (lang.ui !== lang.code) st.say("lang_fallback", { lang: lang.label });
      if (s.editing) {
        s.editing = false;
        st.effects.push({ type: "saveLanguage" });
        return st.goto("REVIEW");
      }
      return st.goto("CONSENT");
    }

    case "CONSENT": {
      const id = choice();
      if (id === "consent:yes") {
        st.effects.push({ type: "consent" });
        return st.startSection("details", false);
      }
      if (id === "consent:more") {
        st.say("consent_more");
        return st.retry();
      }
      if (id === "consent:no") {
        st.say("consent_declined");
        return st.forget();
      }
      return st.retry("use_buttons");
    }

    // ---- Personal details ----
    case "DETAILS_FIRST_NAME": {
      const v = typed && cleanName(typed);
      if (!v) return st.retry("invalid_name");
      d.details.firstName = v;
      return st.goto("DETAILS_SURNAME");
    }
    case "DETAILS_SURNAME": {
      const v = typed && cleanName(typed);
      if (!v) return st.retry("invalid_name");
      d.details.surname = v;
      return st.goto("DETAILS_AREA");
    }
    case "DETAILS_AREA": {
      const v = typed && cleanText(typed, 80);
      if (!v) return st.retry();
      d.details.area = v;
      return st.goto("DETAILS_EMAIL");
    }
    case "DETAILS_EMAIL": {
      if (choice() === "email:skip") {
        d.details.email = null;
        return st.finishSection("details");
      }
      const v = typed && cleanEmail(typed);
      if (!v) return st.retry("invalid_email");
      d.details.email = v;
      return st.finishSection("details");
    }

    // ---- Education ----
    case "EDU_MATRIC": {
      const id = choice();
      if (id === "matric:completed" || id === "matric:studying") {
        d.education.matric = id === "matric:completed" ? "completed" : "studying";
        return st.goto("EDU_SCHOOL");
      }
      if (id === "matric:not_completed") {
        d.education.matric = "not_completed";
        return st.goto("EDU_HIGHEST_GRADE");
      }
      return st.retry("use_buttons");
    }
    case "EDU_SCHOOL": {
      const v = typed && cleanText(typed, 100);
      if (!v) return st.retry();
      d.education.school = v;
      return st.goto("EDU_YEAR");
    }
    case "EDU_YEAR": {
      const y = typed ? parseYear(typed) : null;
      if (!y) return st.retry("invalid_year");
      d.education.year = y;
      return st.goto("EDU_MORE");
    }
    case "EDU_HIGHEST_GRADE": {
      const v = typed && cleanText(typed, 40);
      if (!v) return st.retry();
      d.education.highestGrade = v;
      return st.goto("EDU_MORE");
    }
    case "EDU_MORE": {
      const id = choice();
      if (id === "more:add") return st.goto("EDU_EXTRA_NAME");
      if (id === "more:done") return st.finishSection("education");
      return st.retry("use_buttons");
    }
    case "EDU_EXTRA_NAME": {
      const v = typed && cleanText(typed, 100);
      if (!v) return st.retry();
      s.scratch.extraName = v;
      return st.goto("EDU_EXTRA_YEAR");
    }
    case "EDU_EXTRA_YEAR": {
      let year: number | undefined;
      if (choice() !== "year:skip") {
        const y = typed ? parseYear(typed) : null;
        if (!y) return st.retry("invalid_year");
        year = y;
      }
      d.education.extras.push({ name: s.scratch.extraName ?? "", ...(year ? { year } : {}) });
      s.scratch = {};
      if (d.education.extras.length >= LIMITS.extras) return st.finishSection("education");
      return st.goto("EDU_MORE");
    }

    // ---- Experience ----
    case "EXP_HAS": {
      const id = choice();
      if (id === "exp:yes") return st.goto("EXP_TITLE");
      if (id === "exp:no") {
        st.say("exp_none");
        return st.finishSection("experience");
      }
      return st.retry("use_buttons");
    }
    case "EXP_TITLE": {
      const v = typed && cleanText(typed, 80);
      if (!v) return st.retry();
      s.scratch.title = v;
      return st.goto("EXP_PLACE");
    }
    case "EXP_PLACE": {
      const v = typed && cleanText(typed, 100);
      if (!v) return st.retry();
      s.scratch.place = v;
      return st.goto("EXP_DATES");
    }
    case "EXP_DATES": {
      const v = typed && cleanDates(typed);
      if (!v) return st.retry("invalid_dates");
      s.scratch.dates = v;
      return st.goto("EXP_DESCRIPTION");
    }
    case "EXP_DESCRIPTION": {
      const v = typed && cleanLongText(typed);
      if (!v) return st.retry();
      d.experience.push({
        title: s.scratch.title ?? "",
        place: s.scratch.place ?? "",
        dates: s.scratch.dates ?? "",
        description: v, // the AI rewrite step will add a polished version later
      });
      s.scratch = {};
      if (d.experience.length >= LIMITS.experience) {
        st.say("exp_max", { max: LIMITS.experience });
        return st.finishSection("experience");
      }
      return st.goto("EXP_MORE");
    }
    case "EXP_MORE": {
      const id = choice();
      if (id === "more:add") return st.goto("EXP_TITLE");
      if (id === "more:done") return st.finishSection("experience");
      return st.retry("use_buttons");
    }

    // ---- Skills ----
    case "SKILLS": {
      const skills = typed ? parseSkills(typed) : [];
      if (skills.length === 0) return st.retry("invalid_skills");
      d.skills = skills;
      return st.finishSection("skills");
    }

    // ---- References ----
    case "REF_ASK": {
      const id = choice();
      if (id === "ref:add") {
        d.referencesOnRequest = false;
        return st.goto("REF_NAME");
      }
      if (id === "ref:on_request") {
        d.references = [];
        d.referencesOnRequest = true;
        return st.finishSection("references");
      }
      return st.retry("use_buttons");
    }
    case "REF_NAME": {
      const v = typed && cleanName(typed);
      if (!v) return st.retry("invalid_name");
      s.scratch.refName = v;
      return st.goto("REF_PHONE");
    }
    case "REF_PHONE": {
      const v = typed && cleanSaPhone(typed);
      if (!v) return st.retry("invalid_phone");
      s.scratch.refPhone = v;
      return st.goto("REF_RELATION");
    }
    case "REF_RELATION": {
      const v = typed && cleanText(typed, 100);
      if (!v) return st.retry();
      d.references.push({ name: s.scratch.refName ?? "", phone: s.scratch.refPhone ?? "", relationship: v });
      s.scratch = {};
      if (d.references.length >= LIMITS.references) {
        st.say("ref_max");
        return st.finishSection("references");
      }
      return st.goto("REF_MORE");
    }
    case "REF_MORE": {
      const id = choice();
      if (id === "more:add") return st.goto("REF_NAME");
      if (id === "more:done") return st.finishSection("references");
      return st.retry("use_buttons");
    }

    // ---- After the flow ----
    case "REVIEW":
      // Don't resend the full summary on every "thanks" (each message costs money).
      return st.say("review_footer").done();

    case "EDIT_MENU": {
      const id = choice();
      if (id === "edit:language") {
        s.editing = true;
        return st.goto("LANGUAGE");
      }
      const section = SECTION_ORDER.find((sec) => id === `edit:${sec}`);
      if (!section) return st.retry("use_buttons");
      st.say("edit_hint");
      return st.startSection(section, true);
    }

    case "DELETE_CONFIRM": {
      const id = choice();
      if (id === "del:yes") {
        st.effects.push({ type: "deleteUser", waId: s.waId });
        st.say("deleted");
        return st.forget();
      }
      if (id === "del:no") {
        st.say("delete_cancelled");
        return st.goto(s.stateBeforeDelete ?? "REVIEW");
      }
      return st.retry("use_buttons");
    }
  }
}
