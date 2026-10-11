import { decide } from "./decide";
import { EMAIL_RE, PHONE_RE, platformDomains, platformUrlOk, shapeOk, uniqueMatches, uniqueUrls } from "./gates";
import { headerMatchesField, templateHasPeerHeaders } from "./template";
import type { Decision, FieldInfo, JevAsk } from "./types";

export type SavedPasteField = { label: string; value: string };

export function matchSavedFields(fields: readonly SavedPasteField[], field: FieldInfo): Decision | null {
  const matching = fields.filter((saved) => headerMatchesField(saved.label, field));
  if (!matching.length) return null;
  if (matching.some((saved) => !saved.value.trim())) return { value: "", mode: "whole", reason: "ambiguous-profile-empty" };
  if (new Set(matching.map((saved) => saved.value)).size !== 1) {
    return { value: "", mode: "whole", reason: "ambiguous-profile-conflict" };
  }
  const value = matching[0]!.value;
  if (!shapeOk(field, value, { exactHeader: true })) return { value: "", mode: "whole", reason: "profile-shape" };
  return { value, mode: "slice", reason: "profile-field" };
}

function clipboardHasConflict(clipboard: string, field: FieldInfo): boolean {
  if (field.kind === "email") return uniqueMatches(clipboard, EMAIL_RE).length > 1;
  if (field.kind === "tel") return uniqueMatches(clipboard, PHONE_RE).length > 1;
  if (field.kind === "url" || platformDomains(field)) {
    const urls = uniqueUrls(clipboard);
    return (platformDomains(field) ? urls.filter((url) => platformUrlOk(field, url)) : urls).length > 1;
  }
  return false;
}

function preserveClipboard(decision: Decision, clipboard: string, field: FieldInfo): boolean {
  if (/^(?:ambiguous-|template-shape|source-too-large|secret|verify-|low-|unknown-id|no-pick|invalid-offsets|not-substring|shape|jev-error)/.test(decision.reason)) return true;
  if (decision.reason === "whole") return true;
  if (field.kind === "textarea") return !templateHasPeerHeaders(clipboard, field);
  return clipboardHasConflict(clipboard, field);
}

export async function resolvePaste(
  clipboard: string,
  vault: string,
  field: FieldInfo,
  ask: JevAsk | null,
  savedFields?: readonly SavedPasteField[],
): Promise<Decision> {
  if (clipboard) {
    const fromCopy = await decide(clipboard, field, ask);
    if (fromCopy.mode === "slice") return fromCopy;
    if (preserveClipboard(fromCopy, clipboard, field)) return fromCopy;
  }
  if (savedFields) {
    const saved = matchSavedFields(savedFields, field);
    if (saved) return saved.mode === "slice" ? saved : { ...saved, value: clipboard };
  }
  const note = vault.trim();
  if (note) {
    const fromVault = await decide(note, field, ask);
    if (fromVault.mode === "slice") {
      return { value: fromVault.value, mode: "slice", reason: `vault-${fromVault.reason}` };
    }
    if (fromVault.reason.startsWith("ambiguous-") || fromVault.reason === "template-shape") {
      return { value: clipboard, mode: "whole", reason: `vault-${fromVault.reason}` };
    }
  }
  return {
    value: clipboard,
    mode: "whole",
    reason: clipboard ? "clipboard-whole" : "empty",
  };
}
