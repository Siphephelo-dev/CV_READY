/** Small, forgiving validators. People type on cheap phones in a hurry: accept what's reasonable, tidy it up. */

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

/** Names: letters (any script), spaces, hyphens, apostrophes. Title-cased if typed in all-lower or ALL-CAPS. */
export function cleanName(input: string): string | null {
  const s = collapse(input);
  if (s.length < 2 || s.length > 60) return null;
  if (!/^[\p{L}][\p{L}\s'’-]*$/u.test(s)) return null;
  const allLower = s === s.toLowerCase();
  const allUpper = s === s.toUpperCase();
  if (!allLower && !allUpper) return s;
  return s.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** Free text answers (area, school, job title...). */
export function cleanText(input: string, max = 120): string | null {
  const s = collapse(input);
  if (s.length < 2) return null;
  return s.length > max ? s.slice(0, max) : s;
}

/** Longer free text (job descriptions). Keeps line breaks. */
export function cleanLongText(input: string, max = 1000): string | null {
  const s = input.trim().replace(/[ \t]+/g, " ");
  if (s.length < 3) return null;
  return s.length > max ? s.slice(0, max) : s;
}

export function cleanEmail(input: string): string | null {
  const s = input.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 120 ? s : null;
}

export function parseYear(input: string, now = new Date()): number | null {
  const m = input.match(/\b(19[5-9]\d|20\d\d)\b/);
  if (!m) return null;
  const year = Number(m[1]);
  return year <= now.getFullYear() + 6 ? year : null;
}

/** Work dates are kept as typed ("2023 - now"), but must mention a plausible year. */
export function cleanDates(input: string, now = new Date()): string | null {
  const s = collapse(input);
  return parseYear(s, now) !== null && s.length <= 40 ? s : null;
}

/** South African mobile/landline → +27 format. Accepts 0721234567, 072 123 4567, +27 72 123 4567, 27721234567. */
export function cleanSaPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  let national: string | null = null;
  if (/^0\d{9}$/.test(digits)) national = digits.slice(1);
  else if (/^\+27\d{9}$/.test(digits)) national = digits.slice(3);
  else if (/^27\d{9}$/.test(digits)) national = digits.slice(2);
  return national ? `+27${national}` : null;
}

/** "Customer service, cash handling,teamwork" → ["Customer service", "Cash handling", "Teamwork"] (deduped, max 12). */
export function parseSkills(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[,;\n]/)) {
    const s = collapse(raw);
    if (s.length < 2 || s.length > 60) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s.charAt(0).toUpperCase() + s.slice(1));
    if (out.length === 12) break;
  }
  return out;
}
