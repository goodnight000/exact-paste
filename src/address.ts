import type { FieldInfo } from "./types";

const US = /^([A-Za-z .'-]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/;
const CA = /^([A-Za-z .'-]+),\s*([A-Z]{2})\s+([A-Z]\d[A-Z]\s?\d[A-Z]\d)$/i;
const UK_POST = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const STREET = /^\d+\s+.+/;
const UNIT = /^(?:apt|apartment|unit|suite|ste\.?|buzzer|#)\b.+/i;
const COUNTRIES = [
  "United States",
  "United Kingdom",
  "Great Britain",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Mexico",
  "India",
  "Japan",
  "USA",
];

export type Place = {
  street: string | null;
  unit: string | null;
  city: string;
  state: string | null;
  zip: string;
  country: string | null;
};

export function addressSlot(
  field: FieldInfo,
): "street" | "unit" | "city" | "state" | "zip" | "country" | null {
  const auto = field.autocomplete.toLowerCase();
  if (auto === "street-address" || auto.startsWith("address-line")) return "street";
  if (auto === "address-level2") return "city";
  if (auto === "address-level1") return "state";
  if (auto === "postal-code") return "zip";
  if (auto === "country" || auto === "country-name") return "country";
  const label = `${field.label} ${field.placeholder} ${field.name}`.toLowerCase();
  if (/\b(apt|unit|suite|buzzer)\b/.test(label)) return "unit";
  if (/\bcountry\b/.test(label)) return "country";
  if (/\bstreet\b|\baddress\b/.test(label) && !/\bcity\b|\bstate\b|\bzip\b/.test(label)) return "street";
  if (/\bcity\b/.test(label)) return "city";
  if (/\bstate\b|\bprovince\b/.test(label)) return "state";
  if (/\bzip\b|\bpostal\b/.test(label)) return "zip";
  return null;
}

function countryMention(clipboard: string): string | null {
  const hits: string[] = [];
  for (const name of COUNTRIES) {
    const match = clipboard.match(new RegExp(`\\b${name.replace(/\./g, "\\.")}\\b`, "i"));
    if (!match) continue;
    const at = clipboard.search(new RegExp(name.replace(/\./g, "\\."), "i"));
    if (at >= 0) hits.push(clipboard.slice(at, at + name.length));
  }
  const unique = [...new Set(hits)];
  if (unique.length === 1) return unique[0] ?? null;
  const long = unique.filter((name) => name.length > 3);
  if (long.length === 1) return long[0] ?? null;
  return null;
}

export function usPlace(clipboard: string): Place | null {
  const lines = clipboard.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const hits: { index: number; city: string; state: string; zip: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const us = lines[i]?.match(US);
    if (us) hits.push({ index: i, city: us[1]!.trim(), state: us[2]!, zip: us[3]! });
    const ca = lines[i]?.match(CA);
    if (ca) hits.push({ index: i, city: ca[1]!.trim(), state: ca[2]!.toUpperCase(), zip: ca[3]!.toUpperCase() });
  }
  if (hits.length === 1) {
    const hit = hits[0]!;
    let prev = hit.index > 0 ? lines[hit.index - 1] ?? "" : "";
    let unit: string | null = null;
    if (prev && UNIT.test(prev)) {
      unit = prev;
      prev = hit.index > 1 ? lines[hit.index - 2] ?? "" : "";
    }
    const street = prev && STREET.test(prev) ? prev : null;
    return {
      street,
      unit,
      city: hit.city,
      state: hit.state,
      zip: hit.zip,
      country: countryMention(clipboard),
    };
  }
  const uk: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] && UK_POST.test(lines[i]!)) uk.push(i);
  }
  if (uk.length === 1) {
    const index = uk[0]!;
    const city = index > 0 && !STREET.test(lines[index - 1] ?? "") && !UNIT.test(lines[index - 1] ?? "")
      ? lines[index - 1] ?? ""
      : "";
    const streetIndex = city ? index - 2 : index - 1;
    const maybeStreet = streetIndex >= 0 ? lines[streetIndex] ?? "" : "";
    if (!city) return null;
    return {
      street: STREET.test(maybeStreet) ? maybeStreet : null,
      unit: null,
      city,
      state: null,
      zip: lines[index]!,
      country: countryMention(clipboard),
    };
  }
  return null;
}

export function addressFastPath(
  clipboard: string,
  field: FieldInfo,
): { value: string; reason: string } | null {
  const slot = addressSlot(field);
  if (!slot) return null;
  if (slot === "country") {
    const country = countryMention(clipboard);
    return country ? { value: country, reason: "one-country" } : null;
  }
  const place = usPlace(clipboard);
  if (!place) return null;
  if (slot === "street") return place.street ? { value: place.street, reason: "us-street" } : null;
  if (slot === "unit") return place.unit ? { value: place.unit, reason: "us-unit" } : null;
  if (slot === "city") return { value: place.city, reason: "us-city" };
  if (slot === "state") return place.state ? { value: place.state, reason: "us-state" } : null;
  return { value: place.zip, reason: "us-zip" };
}
