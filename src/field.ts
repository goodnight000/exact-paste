import type { FieldInfo, FieldKind } from "./types";

const SLOT_TYPES = new Set(["text", "email", "tel", "url"]);
const SLOT_AUTOCOMPLETE = new Set([
  "email",
  "username",
  "name",
  "given-name",
  "additional-name",
  "family-name",
  "nickname",
  "organization",
  "organization-title",
  "street-address",
  "address-line1",
  "address-line2",
  "address-line3",
  "address-level1",
  "address-level2",
  "address-level3",
  "postal-code",
  "country",
  "country-name",
  "tel",
  "tel-national",
  "tel-country-code",
  "url",
  "impp",
  "sex",
  "bday",
]);

const SECRET_RE =
  /password|passcode|passphrase|one.?time|otp|verification.?code|security.?code|api.?key|secret|token|credit.?card|card.?number|cardholder|cvv|cvc|cc-|ssn|social.?security|pin\b/i;

const COMPOSER_RE =
  /\b(comment|comments|tweet|search|chat|compose|conversation|reply to)\b/i;

const SLOT_LABEL_RE =
  /\b(email|e-mail|phone|mobile|name|first name|last name|full name|company|organization|title|role|city|location|address|website|url|linkedin|twitter|github|summary|bio|cover letter|profile)\b/i;

const TEXTAREA_SLOT_RE =
  /\b(summary|bio|profile|cover letter|professional|headline|about you|about me)\b/i;

function visible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.hidden || el.closest("[hidden],[inert]")) return false;
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  if (style && (style.display === "none" || style.visibility === "hidden")) return false;
  return true;
}

function textOf(el: Element | null | undefined): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function controlLabel(el: HTMLInputElement | HTMLTextAreaElement): string {
  const labelled = (el.getAttribute("aria-labelledby") ?? "")
    .split(/\s+/)
    .map((id) => textOf(el.ownerDocument.getElementById(id)))
    .filter(Boolean);
  const labels = "labels" in el ? Array.from(el.labels ?? [], (item) => textOf(item)) : [];
  return [
    el.getAttribute("aria-label"),
    el.placeholder,
    el.getAttribute("data-placeholder"),
    ...labelled,
    ...labels,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function autocompleteTokens(el: HTMLInputElement | HTMLTextAreaElement): string[] {
  return (el.autocomplete || el.getAttribute("autocomplete") || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function purpose(el: HTMLInputElement | HTMLTextAreaElement, label: string): string {
  return [label, el.name, el.id, el.getAttribute("autocomplete")].filter(Boolean).join(" ");
}

export function fieldKind(el: HTMLInputElement | HTMLTextAreaElement, label: string): FieldKind {
  if (el instanceof HTMLTextAreaElement) return "textarea";
  const auto = autocompleteTokens(el);
  if (el.type === "email" || auto.includes("email")) return "email";
  if (el.type === "url" || auto.includes("url")) return "url";
  if (el.type === "tel" || auto.some((token) => token.startsWith("tel"))) return "tel";
  return "text";
}

export function isSlot(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;
  if (el.disabled || el.readOnly) return false;
  if (el instanceof HTMLInputElement) {
    const type = (el.type || "text").toLowerCase();
    if (!SLOT_TYPES.has(type)) return false;
  }
  if (!visible(el)) return false;
  const label = controlLabel(el);
  const blob = purpose(el, label);
  if (SECRET_RE.test(blob)) return false;
  if (COMPOSER_RE.test(blob) && !SLOT_LABEL_RE.test(blob)) return false;

  const auto = autocompleteTokens(el);
  if (auto.some((token) => token.startsWith("cc-") || token === "csc")) return false;
  const inForm = Boolean(el.closest("form"));
  const hasLabel = label.length > 0;
  const kind = fieldKind(el, label);

  if (kind === "email" || kind === "url" || kind === "tel") return true;
  if (auto.some((token) => SLOT_AUTOCOMPLETE.has(token))) return true;
  if (el instanceof HTMLTextAreaElement) {
    return TEXTAREA_SLOT_RE.test(blob) || (inForm && hasLabel && SLOT_LABEL_RE.test(blob));
  }
  if (inForm && (hasLabel || el.name || el.placeholder)) return true;
  if (hasLabel && SLOT_LABEL_RE.test(label)) return true;
  return false;
}

export function nearbyLabels(el: HTMLInputElement | HTMLTextAreaElement): string[] {
  const root = el.closest("form, [role=form], fieldset, dialog") ?? el.parentElement;
  if (!root) return [];
  const found: string[] = [];
  const seen = new Set<string>();
  const nodes = root.querySelectorAll("input, textarea, label");
  for (const node of nodes) {
    if (node === el) continue;
    let label = "";
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
      label = controlLabel(node);
    } else {
      label = textOf(node);
    }
    if (!label || seen.has(label)) continue;
    seen.add(label);
    found.push(label);
    if (found.length >= 12) break;
  }
  return found;
}

export function describeField(el: HTMLInputElement | HTMLTextAreaElement): FieldInfo {
  const label = controlLabel(el);
  return {
    label,
    kind: fieldKind(el, label),
    type: el instanceof HTMLInputElement ? el.type : "textarea",
    name: el.name ?? "",
    id: el.id ?? "",
    autocomplete: el.getAttribute("autocomplete") ?? "",
    placeholder: el.placeholder ?? "",
    tag: el.tagName.toLowerCase(),
    nearby: nearbyLabels(el),
  };
}

export function deepActiveElement(doc: Document = document): Element | null {
  let active: Element | null = doc.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}
