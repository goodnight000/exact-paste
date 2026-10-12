import { COUNTRIES } from "./address";
import { FIRM, orgNames } from "./business";
import type { FieldInfo } from "./types";

const PARTICLE = /^(van|von|der|den|de|da|del|della|di|du|la|le|el|bin|al|st|saint)$/i;
// A Capitalized word, a script without case (王小明), or an initial (J.).
const TOKEN = /^(?:[\p{Lu}][\p{L}'’-]*|\p{Lo}+|\p{Lu}\.)$/u;
// Sign-offs and greetings, with or without a name after them ("Cheers", "Hi Sam").
const SIGNOFF =
  /^(?:thanks|thank you|many thanks|cheers|best|regards|kind regards|best regards|warm regards|warmly|sincerely|yours|hi|hello|hey|dear|good morning|good afternoon|talk soon|take care)\b/i;
// ponytail: naive job-title vocabulary. Ceiling: a person surnamed Lead or Head goes to Jev instead of the fast path.
const TITLE =
  /\b(?:designer|engineer|manager|director|developer|analyst|consultant|specialist|coordinator|assistant|associate|officer|president|founder|partner|lead|head|chief|senior|junior|staff|principal|intern|recruiter|executive|vp|ceo|cto|cfo)\b/i;
const HONORIFIC = /^(?:dr|mr|mrs|ms|mx|prof|sir|dame|rev)\.?\s+/i;
const SUFFIX = /,?\s+(?:jr|sr|ii|iii|iv|phd|md|esq)\.?$/i;
const COUNTRY = new RegExp(`^(?:${COUNTRIES.join("|")})$`, "i");

export type NameSlot = "first" | "middle" | "last" | "full";

export type NameParts = {
  full: string;
  first: string;
  last: string | null;
  middle: string | null;
};

export function nameSlot(field: FieldInfo): NameSlot | null {
  // A complete visible question must not be overridden by a machine name.
  const primary = field.label.trim() || field.placeholder.trim();
  const label = (primary || field.name || field.id).replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ").replace(/^(your|my|the)\s+/i, "").replace(/[\s:*]+$/, "");
  if (/^(first(?: name)?|given(?: name)?|forename|fname)$/i.test(label)) return "first";
  if (/^(last(?: name)?|family name|surname|lname)$/i.test(label)) return "last";
  if (/^(middle name|additional name)$/i.test(label)) return "middle";
  if (/^(?:(?:full|contact|recipient|guest|applicant|customer|client|referrer)\s+)?name$/i.test(label)) return "full";
  if (primary) return null;
  const auto = field.autocomplete.toLowerCase();
  if (auto === "given-name") return "first";
  if (auto === "family-name") return "last";
  if (auto === "additional-name") return "middle";
  if (auto === "name") return "full";
  return null;
}

// Strip what wraps a name on its line: a tab-separated column, <email>, an honorific, a suffix.
export function cleanNameLine(raw: string): string {
  return (raw.split("\t")[0] ?? "")
    .trim()
    .replace(/\s*<[^>]*>\s*$/, "")
    .replace(HONORIFIC, "")
    .replace(SUFFIX, "")
    .trim();
}

export function isNameLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || /[0-9@:/&,]/.test(trimmed)) return false;
  if (SIGNOFF.test(trimmed) || TITLE.test(trimmed) || FIRM.test(trimmed) || COUNTRY.test(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  if (words.length < 1 || words.length > 4) return false;
  return words.every((word) => TOKEN.test(word) || PARTICLE.test(word)) && words.some((word) => TOKEN.test(word));
}

export function splitName(full: string): NameParts {
  const words = full.trim().split(/\s+/);
  const first = words[0] ?? full;
  if (words.length === 1) return { full, first, last: null, middle: null };
  let lastStart = words.length - 1;
  while (lastStart > 1 && PARTICLE.test(words[lastStart - 1] ?? "")) lastStart -= 1;
  const last = words.slice(lastStart).join(" ");
  const middleWords = words.slice(1, lastStart);
  return {
    full,
    first,
    last,
    middle: middleWords.length ? middleWords.join(" ") : null,
  };
}

// The person on one line, or null. "Chen, Maya" comes back as "Maya Chen"; "Maya Chen, Designer" as "Maya Chen".
function personOnLine(raw: string): string | null {
  const line = cleanNameLine(raw).replace(/[,.;!]+$/, "");
  if (/[0-9@:/&]/.test(line)) return null;
  if (!line.includes(",")) return isNameLine(line) ? line : null;
  const parts = line.split(",").map((part) => part.trim());
  if (parts.length !== 2) return null;
  const [head, tail] = parts as [string, string];
  if (!isNameLine(head)) return null;
  if (!isNameLine(tail)) return head;
  if (/^\p{Lu}{2,3}$/u.test(tail)) return null; // "San Francisco, CA"
  return `${tail} ${head}`;
}

const LABELLED = /^(?:(?:full\s+)?name|guest|contact|attn|attention|recipient|customer|client|applicant)(?:\s*:\s*|\s*\n\s*)(.+)$/im;

export function personName(clipboard: string): string | null {
  const labelled = clipboard.match(LABELLED);
  if (labelled?.[1]) {
    const person = personOnLine(labelled[1]);
    if (person) return person;
  }
  const orgs = new Set(orgNames(clipboard));
  const people = new Set<string>();
  for (const line of clipboard.split(/\r?\n/)) {
    if (orgs.has(cleanNameLine(line))) continue;
    const person = personOnLine(line);
    if (person) people.add(person);
  }
  return people.size === 1 ? [...people][0] ?? null : null;
}

// Split a full name Jev picked into the part a first/middle/last field wants.
export function namePart(full: string, slot: NameSlot): string | null {
  const person = personOnLine(full);
  if (!person) return null;
  if (slot !== "full" && !canSplit(person)) return null;
  const parts = splitName(person);
  if (slot === "full") return parts.full;
  if (slot === "first") return parts.first;
  return parts[slot];
}

function canSplit(full: string): boolean {
  const words = full.split(/\s+/);
  // Compound given names, double surnames and unspaced family-first names need
  // explicit part labels. Initials and surname particles are distinguishable.
  return words.length > 1 && (words.length === 2 || words.slice(1, -1).every(word => PARTICLE.test(word) || /^\p{Lu}\.$/u.test(word)));
}

const LABELLED_FIRST = /^(?:first|given)\s*name\s*:\s*(.+)$/im;
const LABELLED_LAST = /^(?:last|family)\s*name\s*:\s*(.+)$/im;

export function nameFastPath(clipboard: string, field: FieldInfo): { value: string; reason: string } | null {
  const slot = nameSlot(field);
  if (!slot) return null;
  if (slot === "first" || slot === "last") {
    const part = clipboard.match(slot === "first" ? LABELLED_FIRST : LABELLED_LAST)?.[1]?.trim();
    if (part && isNameLine(part)) return { value: part, reason: `labelled-${slot}` };
  }
  const full = personName(clipboard);
  if (!full) return null;
  if (slot !== "full" && !canSplit(full)) return null;
  const parts = splitName(full);
  if (slot === "full") return { value: parts.full, reason: "one-name" };
  if (slot === "first") return { value: parts.first, reason: "first-name" };
  if (slot === "last" && parts.last) return { value: parts.last, reason: "last-name" };
  if (slot === "middle" && parts.middle) return { value: parts.middle, reason: "middle-name" };
  return null;
}
