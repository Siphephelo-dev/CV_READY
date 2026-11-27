import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyDraft, type CvDraft, type Section, type UiLang } from "../bot/types.js";
import type { CvRepository, StoredCv } from "./cv-repository.js";

/** Payload sent to the save_section() Postgres function for each section. */
export function sectionPayload(section: Section, draft: CvDraft): unknown {
  switch (section) {
    case "details":
      return draft.details;
    case "education":
      return draft.education;
    case "experience":
      return draft.experience;
    case "skills":
      return draft.skills;
    case "references":
      return { items: draft.references, onRequest: draft.referencesOnRequest };
  }
}

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Supabase ${what} failed: ${res.error.message}`);
  return res.data;
}

/** PostgREST returns one-to-one embeds as an object, but be defensive in case it returns an array. */
const one = <T>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : (v ?? undefined));

export class SupabaseCvRepository implements CvRepository {
  constructor(private readonly db: SupabaseClient) {}

  async recordConsent(waId: string, preferredLanguage: string | undefined, uiLanguage: UiLang, consentVersion: string) {
    const row = check(
      await this.db
        .from("users")
        .upsert(
          {
            wa_id: waId,
            preferred_language: preferredLanguage ?? null,
            ui_language: uiLanguage,
            consent_version: consentVersion,
            consented_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "wa_id" },
        )
        .select("id")
        .single(),
      "recordConsent",
    );
    return (row as { id: string }).id;
  }

  async saveLanguage(userId: string, preferredLanguage: string | undefined, uiLanguage: UiLang) {
    check(
      await this.db
        .from("users")
        .update({ preferred_language: preferredLanguage ?? null, ui_language: uiLanguage, updated_at: new Date().toISOString() })
        .eq("id", userId),
      "saveLanguage",
    );
  }

  async saveSection(userId: string, section: Section, draft: CvDraft) {
    check(
      await this.db.rpc("save_section", { p_user_id: userId, p_section: section, p_data: sectionPayload(section, draft) }),
      `saveSection(${section})`,
    );
  }

  async markCompleted(userId: string) {
    check(
      await this.db.from("users").update({ completed_at: new Date().toISOString() }).eq("id", userId),
      "markCompleted",
    );
  }

  async load(waId: string): Promise<StoredCv | null> {
    const row = check(
      await this.db
        .from("users")
        .select(
          "id, preferred_language, ui_language, completed_at, references_on_request, profiles(*), education(*), qualifications(*), experiences(*), skills(*), cv_references(*)",
        )
        .eq("wa_id", waId)
        .maybeSingle(),
      "load",
    ) as Record<string, any> | null;
    if (!row) return null;

    const draft = emptyDraft();
    const p = one(row.profiles);
    if (p) draft.details = { firstName: p.first_name ?? undefined, surname: p.surname ?? undefined, area: p.area ?? undefined, email: p.email };
    const e = one(row.education);
    const byPos = (a: { position: number }, b: { position: number }) => a.position - b.position;
    draft.education = {
      matric: e?.matric_status ?? undefined,
      school: e?.school ?? undefined,
      year: e?.year ?? undefined,
      highestGrade: e?.highest_grade ?? undefined,
      extras: ((row.qualifications ?? []) as any[]).sort(byPos).map((q) => ({ name: q.name, ...(q.year ? { year: q.year } : {}) })),
    };
    draft.experience = ((row.experiences ?? []) as any[])
      .sort(byPos)
      .map((x) => ({ title: x.title, place: x.place, dates: x.dates, description: x.description }));
    draft.skills = one(row.skills)?.items ?? [];
    draft.references = ((row.cv_references ?? []) as any[])
      .sort(byPos)
      .map((r) => ({ name: r.name, phone: r.phone, relationship: r.relationship }));
    draft.referencesOnRequest = Boolean(row.references_on_request);

    return {
      userId: row.id,
      preferredLanguage: row.preferred_language,
      uiLanguage: row.ui_language === "zu" ? "zu" : "en",
      completed: Boolean(row.completed_at),
      draft,
    };
  }

  async deleteUser(waId: string) {
    // Child rows go too (ON DELETE CASCADE).
    check(await this.db.from("users").delete().eq("wa_id", waId), "deleteUser");
    const hash = createHash("sha256").update(waId).digest("hex");
    check(await this.db.from("deletion_log").insert({ wa_id_hash: hash }), "deletion_log");
  }
}
