import type { FieldInfo } from "./types";

// Bound local parts and domain labels, and never extract a valid-looking suffix
// from an invalid huge token. Unbounded local parts cause quadratic scans on a
// large copied string with no @ sign.
export const EMAIL_RE = /(?<![\p{L}\p{N}.!#$%&'*+/=?^_`{|}~-])[\p{L}\p{N}.!#$%&'*+/=?^_`{|}~-]{1,64}@(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.){1,127}[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?(?![\p{L}\p{N}-]|\.[\p{L}\p{N}-])/gu;
export const URL_RE = /https?:\/\/[^\s<>"'`]+/gi;
export const BARE_URL_RE = /(?<![a-z0-9.-])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.){1,127}[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?::\d{1,5})?(?![a-z0-9:-]|\.[a-z0-9-])(?:[/?#][^\s<>"'`]*)?/gi;
export const PHONE_RE = /(?<!\w)(?:\+?\d[\d().\s-]{6,}\d)/g;

const CARD_RE = /\b(?:\d[ -]*?){13,19}\b/;
const PRIVATE_KEY_RE = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
const KEYISH_RE = /\b(?:sk-|rk-|api[_-]?key|AKIA)[A-Za-z0-9_-]{16,}\b/;
const LABELLED_SECRET_RE = /\b(?:api[ _-]?key|access[ _-]?token|refresh[ _-]?token|client[ _-]?secret|password|passphrase)\b["'\s]*[:=]["'\s]*\S{4,}/i;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+\/-]{16,}/i;
const URL_CREDENTIAL_RE = /https?:\/\/[^\s/<>]+@/i;

export function uniqueUrls(text: string): string[] {
  const emails = text.includes("@") ? [...text.matchAll(EMAIL_RE)].map((match) => ({ start: match.index, end: match.index + match[0].length })) : [];
  const full = [...text.matchAll(URL_RE)].map((match) => ({ start: match.index, end: match.index + match[0].length, value: trimMatch(match[0]) }));
  const urls = new Set(full.map((match) => match.value));
  let fullIndex = 0;
  let emailIndex = 0;
  for (const match of text.matchAll(BARE_URL_RE)) {
    const start = match.index;
    const end = start + match[0].length;
    while (full[fullIndex] && full[fullIndex]!.end <= start) fullIndex++;
    while (emails[emailIndex] && emails[emailIndex]!.end <= start) emailIndex++;
    const containingUrl = full[fullIndex];
    const containingEmail = emails[emailIndex];
    if (containingUrl && start >= containingUrl.start && end <= containingUrl.end) continue;
    if (containingEmail && start >= containingEmail.start && end <= containingEmail.end) continue;
    urls.add(trimMatch(match[0]));
  }
  return [...urls].filter(isUrl);
}

function trimMatch(raw: string): string {
  let end = raw.length;
  while (end > 0 && /[.,;:]/.test(raw[end - 1]!)) end--;
  const counts: Record<string, number> = { "(": 0, ")": 0, "[": 0, "]": 0, "{": 0, "}": 0 };
  for (let index = 0; index < end; index++) {
    const char = raw[index]!;
    if (char in counts) counts[char]!++;
  }
  // Preserve balanced URL path delimiters, removing only surrounding prose.
  while (end > 0 && /[)\]}]/.test(raw[end - 1]!)) {
    const close = raw[end - 1]!;
    const open = ({ ")": "(", "]": "[", "}": "{" } as Record<string, string>)[close]!;
    if (counts[close]! <= counts[open]!) break;
    counts[close]!--;
    end--;
    while (end > 0 && /[.,;:]/.test(raw[end - 1]!)) end--;
  }
  return raw.slice(0, end);
}

export function uniqueMatches(text: string, re: RegExp): string[] {
  if (re.source === EMAIL_RE.source && !text.includes("@")) return [];
  let found: string[];
  if (re.source === EMAIL_RE.source && /https?:\/\//i.test(text)) {
    const urls = [...text.matchAll(URL_RE)].map((match) => ({ start: match.index, end: match.index + match[0].length }));
    let index = 0;
    found = [];
    for (const match of text.matchAll(new RegExp(re.source, re.flags))) {
      while (urls[index] && urls[index]!.end <= match.index) index++;
      if (urls[index] && match.index >= urls[index]!.start && match.index < urls[index]!.end) continue;
      found.push(match[0]);
    }
  } else found = text.match(new RegExp(re.source, re.flags)) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of found) {
    const value = trimMatch(raw);
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
  return PRIVATE_KEY_RE.test(clipboard) || KEYISH_RE.test(clipboard) || CARD_RE.test(clipboard) || LABELLED_SECRET_RE.test(clipboard) || BEARER_RE.test(clipboard) || URL_CREDENTIAL_RE.test(clipboard);
}

export function isEmail(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length > 320) return false;
  const at = trimmed.lastIndexOf("@");
  if (at < 1 || at > 64 || trimmed.length - at - 1 > 253) return false;
  const found = trimmed.match(EMAIL_RE);
  const local = trimmed.slice(0, at);
  return found?.length === 1 && found[0] === trimmed && !local.startsWith(".") && !local.endsWith(".") && !local.includes("..");
}

export function isUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  if (/^\d+(\.\d+)+$/.test(trimmed)) return false;
  if (!/^https?:\/\//i.test(trimmed) && !/^(?:[\p{L}\p{N}-]+\.)+[\p{L}\p{N}-]{2,}(?::\d+)?(?:[/?#][^\s]*)?$/u.test(trimmed)) return false;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const hostname = url.hostname.replace(/\.$/, "");
    const validHost = hostname.startsWith("[") || (hostname.length <= 253 && hostname.split(".").every((part) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(part)));
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(hostname) && validHost && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function platformDomains(field: FieldInfo): readonly string[] | null {
  const primary = field.label.trim() || field.name || field.id;
  if (/\busername\b/i.test(primary)) return null;
  // Mentioning a platform in an essay question does not make it a URL slot.
  if (field.kind !== "url" && !/^(?:(?:your|personal|company)\s+)?(?:linkedin|github|twitter|x\s*\/\s*twitter|x|instagram|facebook|tiktok|youtube)(?:\s+(?:profile|url|link|address))*\s*\*?$/i.test(primary)) return null;
  const label = `${primary} ${field.kind === "url" ? field.placeholder : ""}`;
  if (/\blinkedin\b/i.test(label)) return ["linkedin.com"];
  if (/\bgithub\b/i.test(label)) return ["github.com"];
  if (/\btwitter\b|\bx\s*(?:\/\s*twitter|profile|url)\b/i.test(label)) return ["twitter.com", "x.com"];
  if (/\binstagram\b/i.test(label)) return ["instagram.com"];
  if (/\bfacebook\b/i.test(label)) return ["facebook.com"];
  if (/\btiktok\b/i.test(label)) return ["tiktok.com"];
  if (/\byoutube\b/i.test(label)) return ["youtube.com", "youtu.be"];
  return null;
}

export function platformUrlOk(field: FieldInfo, value: string): boolean {
  const domains = platformDomains(field);
  if (!domains) return true;
  if (!isUrl(value)) return false;
  const hostname = new URL(/^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`).hostname.toLowerCase().replace(/\.$/, "");
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

export function isPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function shapeOk(field: FieldInfo, value: string, options: { exactHeader?: boolean } = {}): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (platformDomains(field) && !platformUrlOk(field, trimmed)) return false;
  switch (field.kind) {
    case "email":
      return isEmail(trimmed);
    case "url":
      return isUrl(trimmed);
    case "tel":
      if (/\btel-country-code\b/.test(field.autocomplete)) return /^\+?\d{1,4}$/.test(trimmed);
      if (/\btel-extension\b/.test(field.autocomplete)) return /^\d{1,8}$/.test(trimmed);
      return isPhone(trimmed);
    case "text":
      if (/^(invoice date|due date|payment due date)\s*\*?$/i.test(field.label.trim()) &&
        !/^(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+[\p{L}.]+\s+\d{4}|[\p{L}.]+\s+\d{1,2},?\s+\d{4})$/u.test(trimmed)) return false;
      if (isEmail(trimmed) && !/email|e-mail|user/i.test(field.label)) return false;
      if (isUrl(trimmed) && (!/url|website|profile|link|http|github|twitter|instagram|facebook|tiktok|youtube/i.test(field.label) || /\busername\b/i.test(field.label))) return false;
      if (!options.exactHeader && trimmed.length > 120) return false;
      if (/[\r\n]/.test(trimmed)) return false;
      return true;
    case "textarea":
      return options.exactHeader || trimmed.length <= 8000;
  }
}

export function lead(probabilities: Record<string, number>, picked: string): number {
  if (!probabilities || typeof probabilities !== "object" || Array.isArray(probabilities)) return 0;
  if (!Object.prototype.hasOwnProperty.call(probabilities, picked)) return 0;
  const values = Object.entries(probabilities).sort((a, b) => b[1] - a[1]);
  if (!values.length || values.some(([, value]) => !Number.isFinite(value) || value < 0 || value > 1)) return 0;
  if (values[0]?.[0] !== picked) return 0;
  return (values[0][1] ?? 0) - (values[1]?.[1] ?? 0);
}
