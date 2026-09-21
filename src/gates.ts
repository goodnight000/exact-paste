import type { FieldInfo } from "./types";

export const EMAIL_RE = /[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/g;
export const URL_RE = /https?:\/\/[^\s<>"'`]+/gi;
export const BARE_URL_RE = /\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s<>"'`]*)?/gi;
export const PHONE_RE = /(?<!\w)(?:\+?\d[\d().\s-]{6,}\d)/g;

const CARD_RE = /\b(?:\d[ -]*?){13,19}\b/;
const PRIVATE_KEY_RE = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
const KEYISH_RE = /\b(?:sk-|rk-|api[_-]?key|AKIA)[A-Za-z0-9_-]{16,}\b/;

export function uniqueUrls(text: string): string[] {
  const emails = uniqueMatches(text, EMAIL_RE);
  const full = uniqueMatches(text, URL_RE);
  const bare = uniqueMatches(text, BARE_URL_RE).filter((url) => !emails.some((email) => email.includes(url)));
  const all = [...new Set([...full, ...bare])];
  return all.filter((url) => !all.some((other) => other !== url && other.includes(url)));
}

export function uniqueMatches(text: string, re: RegExp): string[] {
  const found = text.match(new RegExp(re.source, re.flags)) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of found) {
    const value = raw.replace(/[),.;:]+$/, "");
    if (!seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}

export function isSubstring(clipboard: string, value: string): boolean {
  return value.length > 0 && clipboard.includes(value);
}

export function looksSecret(clipboard: string): boolean {
  return PRIVATE_KEY_RE.test(clipboard) || KEYISH_RE.test(clipboard) || CARD_RE.test(clipboard);
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isUrl(value: string): boolean {
  const trimmed = value.trim();
  if (/^https?:\/\/[^\s]+$/.test(trimmed)) return true;
  if (/^\d+(\.\d+)+$/.test(trimmed)) return false;
  return /^(www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/[^\s]*)?$/i.test(trimmed);
}

export function isPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function shapeOk(field: FieldInfo, value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  switch (field.kind) {
    case "email":
      return isEmail(trimmed);
    case "url":
      return isUrl(trimmed);
    case "tel":
      return isPhone(trimmed);
    case "text":
      if (isEmail(trimmed) && !/email|e-mail|user/i.test(field.label)) return false;
      if (isUrl(trimmed) && !/url|website|profile|link|http/i.test(field.label)) return false;
      if (trimmed.length > 120) return false;
      if (trimmed.includes("\n")) return false;
      return true;
    case "textarea":
      return trimmed.length <= 8000;
  }
}

export function lead(probabilities: Record<string, number>, picked: string): number {
  const values = Object.entries(probabilities).sort((a, b) => b[1] - a[1]);
  if (values[0]?.[0] !== picked) return 0;
  return (values[0][1] ?? 0) - (values[1]?.[1] ?? 0);
}
