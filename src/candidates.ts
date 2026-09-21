import { amounts, dueDates, invoiceNumbers, orgNames } from "./business";
import { EMAIL_RE, PHONE_RE, URL_RE, BARE_URL_RE, uniqueMatches } from "./gates";
import type { Candidate } from "./types";

const NAME_RE = /\b[A-Z][a-z]+(?:[.'-][A-Z]?[a-z]+)*(?:\s+[A-Z][a-z]+(?:[.'-][A-Z]?[a-z]+)*){0,3}\b/g;
const LABEL_LINE_RE = /^[^\n:]{1,40}:\s*(\S[^\n]*)$/gm;

function add(
  out: Candidate[],
  seen: Set<string>,
  clipboard: string,
  text: string,
  hint: string,
): void {
  const value = text.trim();
  if (!value || seen.has(value)) return;
  const start = clipboard.indexOf(value);
  if (start < 0) return;
  seen.add(value);
  out.push({
    id: hint + String(out.length),
    text: value,
    start,
    end: start + value.length,
  });
}

export function candidates(clipboard: string): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  const source = clipboard.length > 12_000 ? clipboard.slice(0, 12_000) : clipboard;

  for (const email of uniqueMatches(source, EMAIL_RE)) add(out, seen, source, email, "e");
  for (const url of uniqueMatches(source, URL_RE)) add(out, seen, source, url, "u");
  for (const url of uniqueMatches(source, BARE_URL_RE)) add(out, seen, source, url, "b");
  for (const phone of uniqueMatches(source, PHONE_RE)) add(out, seen, source, phone, "p");
  for (const id of invoiceNumbers(source)) add(out, seen, source, id, "i");
  for (const org of orgNames(source)) add(out, seen, source, org, "o");
  for (const amount of amounts(source)) add(out, seen, source, amount, "a");
  for (const date of dueDates(source)) add(out, seen, source, date, "d");

  for (const match of source.matchAll(LABEL_LINE_RE)) {
    add(out, seen, source, match[1] ?? "", "l");
  }

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length >= 1 && trimmed.length <= 80) add(out, seen, source, trimmed, "n");
  }

  for (const match of source.matchAll(NAME_RE)) {
    const name = match[0];
    if (name.length >= 3 && name.length <= 80) add(out, seen, source, name, "m");
  }

  const capped = out.slice(0, 40);
  capped.push({
    id: "whole",
    text: clipboard,
    start: 0,
    end: clipboard.length,
  });
  return capped;
}
