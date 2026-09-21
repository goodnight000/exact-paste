import type { FieldInfo } from "./types";

const PLACE = /^([A-Za-z .'-]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/;
const STREET = /^\d+\s+.+/;

export type Place = {
  street: string | null;
  city: string;
  state: string;
  zip: string;
};

export function addressSlot(field: FieldInfo): "street" | "city" | "state" | "zip" | null {
  const auto = field.autocomplete.toLowerCase();
  if (auto === "street-address" || auto.startsWith("address-line")) return "street";
  if (auto === "address-level2") return "city";
  if (auto === "address-level1") return "state";
  if (auto === "postal-code") return "zip";
  const label = `${field.label} ${field.placeholder} ${field.name}`.toLowerCase();
  if (/\bstreet\b|\baddress\b/.test(label) && !/\bcity\b|\bstate\b|\bzip\b/.test(label)) return "street";
  if (/\bcity\b/.test(label)) return "city";
  if (/\bstate\b|\bprovince\b/.test(label)) return "state";
  if (/\bzip\b|\bpostal\b/.test(label)) return "zip";
  return null;
}

export function usPlace(clipboard: string): Place | null {
  const lines = clipboard.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const hits: { index: number; city: string; state: string; zip: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i]?.match(PLACE);
    if (match) hits.push({ index: i, city: match[1]!.trim(), state: match[2]!, zip: match[3]! });
  }
  if (hits.length !== 1) return null;
  const hit = hits[0]!;
  const previous = hit.index > 0 ? lines[hit.index - 1] : "";
  const street = previous && STREET.test(previous) ? previous : null;
  return { street, city: hit.city, state: hit.state, zip: hit.zip };
}

export function addressFastPath(
  clipboard: string,
  field: FieldInfo,
): { value: string; reason: string } | null {
  const slot = addressSlot(field);
  if (!slot) return null;
  const place = usPlace(clipboard);
  if (!place) return null;
  if (slot === "street") return place.street ? { value: place.street, reason: "us-street" } : null;
  if (slot === "city") return { value: place.city, reason: "us-city" };
  if (slot === "state") return { value: place.state, reason: "us-state" };
  return { value: place.zip, reason: "us-zip" };
}
