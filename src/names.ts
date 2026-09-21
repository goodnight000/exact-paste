import type { FieldInfo } from "./types";

const PARTICLES = new Set(["van", "von", "de", "da", "del", "della", "di", "du", "la", "le", "el", "bin", "al", "st", "saint"]);
const TOKEN = /^[\p{Lu}][\p{L}'’-]*$/u;
const PARTICLE = /^(van|von|de|da|del|della|di|du|la|le|el|bin|al|st|saint)$/i;

export type NameSlot = "first" | "middle" | "last" | "full";

export type NameParts = {
  full: string;
  first: string;
  last: string | null;
  middle: string | null;
};

export function nameSlot(field: FieldInfo): NameSlot | null {
  const auto = field.autocomplete.toLowerCase();
  if (auto === "given-name") return "first";
  if (auto === "family-name") return "last";
  if (auto === "additional-name") return "middle";
  if (auto === "name") return "full";
  const label = `${field.label} ${field.placeholder} ${field.name} ${field.id}`;
  if (/\b(first\s*name|given\s*name)\b/i.test(label)) return "first";
  if (/\b(last\s*name|family\s*name|surname)\b/i.test(label)) return "last";
  if (/\bmiddle\s*name\b/i.test(label)) return "middle";
  if (/\bfull\s*name\b/i.test(label)) return "full";
  if (/\bname\b/i.test(label) && !/\b(user|company|org|file|card|host)\s*name\b/i.test(label)) return "full";
  return null;
}

export function isNameLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || /[0-9@:/&,]/.test(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  if (words.length < 1 || words.length > 4) return false;
  return words.every((word) => TOKEN.test(word) || PARTICLE.test(word)) && words.some((word) => TOKEN.test(word));
}

export function splitName(full: string): NameParts {
  const words = full.trim().split(/\s+/);
  const first = words[0] ?? full;
  if (words.length === 1) return { full, first, last: null, middle: null };
  let lastStart = words.length - 1;
  if (lastStart >= 1 && PARTICLES.has((words[lastStart - 1] ?? "").toLowerCase())) lastStart -= 1;
  const last = words.slice(lastStart).join(" ");
  const middleWords = words.slice(1, lastStart);
  return {
    full,
    first,
    last,
    middle: middleWords.length ? middleWords.join(" ") : null,
  };
}

export function personName(clipboard: string): string | null {
  const labelled = clipboard.match(/^(?:full\s+)?name:\s*(.+)$/im);
  if (labelled?.[1] && isNameLine(labelled[1])) return labelled[1].trim();
  const lines = clipboard.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const names = lines.filter(isNameLine);
  if (names.length === 1) return names[0] ?? null;
  return null;
}

export function nameFastPath(clipboard: string, field: FieldInfo): { value: string; reason: string } | null {
  const slot = nameSlot(field);
  if (!slot) return null;
  const full = personName(clipboard);
  if (!full || !clipboard.includes(full)) return null;
  const parts = splitName(full);
  if (slot === "full") return { value: parts.full, reason: "one-name" };
  if (slot === "first") return { value: parts.first, reason: "first-name" };
  if (slot === "last" && parts.last) return { value: parts.last, reason: "last-name" };
  if (slot === "middle" && parts.middle) return { value: parts.middle, reason: "middle-name" };
  return null;
}
