import { t } from "./i18n.js";
import type { Session } from "./types.js";

/** Plain-text CV summary shown in WhatsApp before the PDF exists. Uses WhatsApp *bold* formatting. */
export function renderSummary(s: Session): string {
  const L = s.lang;
  const { details, education, experience, skills, references, referencesOnRequest } = s.draft;
  const lines: string[] = [];

  lines.push(`*${[details.firstName, details.surname].filter(Boolean).join(" ")}*`);
  lines.push(`${t(L, "label_phone")}: +${s.waId}`);
  if (details.area) lines.push(`${t(L, "label_area")}: ${details.area}`);
  if (details.email) lines.push(`${t(L, "label_email")}: ${details.email}`);

  lines.push("", `*${t(L, "section_education")}*`);
  if (education.matric === "completed" || education.matric === "studying") {
    const status = t(L, education.matric === "completed" ? "matric_completed" : "matric_studying");
    lines.push(`${t(L, "label_matric")} (${status}): ${education.school ?? ""}, ${education.year ?? ""}`);
  } else if (education.matric === "not_completed") {
    lines.push(`${t(L, "label_highest_grade")}: ${education.highestGrade ?? ""}`);
  }
  for (const x of education.extras) lines.push(`• ${x.name}${x.year ? `, ${x.year}` : ""}`);

  lines.push("", `*${t(L, "section_experience")}*`);
  if (experience.length === 0) lines.push(t(L, "label_none"));
  for (const job of experience) lines.push(`• ${job.title}, ${job.place} (${job.dates})`);

  lines.push("", `*${t(L, "section_skills")}*`, skills.length ? skills.join(", ") : t(L, "label_none"));

  lines.push("", `*${t(L, "section_references")}*`);
  if (referencesOnRequest || references.length === 0) lines.push(t(L, "label_on_request"));
  for (const r of references) lines.push(`• ${r.name}, ${r.relationship} (${r.phone})`);

  return lines.join("\n");
}
