import type { FieldInfo } from "./types";

function unique(clipboard: string, values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw.trim().replace(/[.,;:]+$/, "");
    if (!value || seen.has(value) || !clipboard.includes(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

export function invoiceNumbers(clipboard: string): string[] {
  const found: string[] = [];
  for (const match of clipboard.matchAll(/\bINV[-_]\d[A-Z0-9]*\b/gi)) {
    found.push(match[0]);
  }
  for (const match of clipboard.matchAll(/\binvoice(?:\s+(?:number|no\.?|#))?\s*[:#]?\s*([A-Z]{2,8}[-_]\d{2,}|[A-Z]{2,8}\d{3,})\b/gi)) {
    if (match[1]) found.push(match[1]);
  }
  return unique(clipboard, found);
}

export function orgNames(clipboard: string): string[] {
  const found: string[] = [];
  for (const match of clipboard.matchAll(/\bplease pay\s+([^.\n]+)/gi)) {
    if (match[1]) found.push(match[1]);
  }
  for (const match of clipboard.matchAll(
    /\b([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,5}\s(?:LLC|L\.L\.C\.|Inc\.?|Ltd\.?|LLP|Corp\.?|GmbH))\b/g,
  )) {
    if (match[1]) found.push(match[1]);
  }
  return unique(clipboard, found);
}

export function amounts(clipboard: string): string[] {
  const found: string[] = [];
  for (const match of clipboard.matchAll(/\bamount(?:\s+due)?\s*:\s*(\d[\d,]*\.\d{2})\b/gi)) {
    if (match[1]) found.push(match[1]);
  }
  for (const match of clipboard.matchAll(/\$(\d[\d,]*\.\d{2})\b/g)) {
    if (match[1]) found.push(match[1]);
  }
  if (found.length === 0) {
    for (const match of clipboard.matchAll(/\b(\d{1,7}\.\d{2})\b/g)) found.push(match[1]!);
  }
  return unique(clipboard, found);
}

export function dueDates(clipboard: string): string[] {
  const found: string[] = [];
  for (const match of clipboard.matchAll(/^(?:due(?:\s+date)?)\s*:\s*(.+)$/gim)) {
    if (match[1]) found.push(match[1]);
  }
  for (const match of clipboard.matchAll(/\bdue date\s*:\s*([^\n]+)/gi)) {
    if (match[1]) found.push(match[1]);
  }
  for (const match of clipboard.matchAll(/\bdue\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})\b/gi)) {
    if (match[1]) found.push(match[1]);
  }
  return unique(clipboard, found);
}

function blob(field: FieldInfo): string {
  return `${field.label} ${field.name} ${field.autocomplete} ${field.placeholder}`.toLowerCase();
}

export function businessFastPath(
  clipboard: string,
  field: FieldInfo,
): { value: string; reason: string } | null {
  const text = blob(field);
  if (/\binvoice\b|\binv\b/.test(text)) {
    const ids = invoiceNumbers(clipboard);
    if (ids.length === 1 && ids[0]) return { value: ids[0], reason: "one-invoice" };
  }
  if (field.autocomplete === "organization" || /\b(vendor|company|organization|payee|supplier)\b/.test(text)) {
    const orgs = orgNames(clipboard);
    if (orgs.length === 1 && orgs[0]) return { value: orgs[0], reason: "one-org" };
  }
  if (/\bamount\b|\btotal\b|\bbalance\b/.test(text) && !/\bdue date\b/.test(text)) {
    const money = amounts(clipboard);
    if (money.length === 1 && money[0]) return { value: money[0], reason: "one-amount" };
  }
  if (/\bdue date\b|\binvoice date\b/.test(text)) {
    const dates = dueDates(clipboard);
    if (dates.length === 1 && dates[0]) return { value: dates[0], reason: "one-due-date" };
  }
  return null;
}
