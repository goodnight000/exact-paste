import { insertValue } from "./insert";
import type { Decision } from "./types";

function prefix(value: string, limit: number): string {
  let end = Math.min(value.length, Math.max(0, limit));
  if (end > 0 && end < value.length && /[\uD800-\uDBFF]/.test(value[end - 1]!) &&
    /[\uDC00-\uDFFF]/.test(value[end]!)) end--;
  return value.slice(0, end);
}

export function applyPaste(
  el: HTMLInputElement | HTMLTextAreaElement,
  decision: Decision,
  clipboard: string,
): boolean {
  const max = el.maxLength;
  const normalize = (value: string): string => el instanceof HTMLTextAreaElement
    ? value.replace(/\r\n?/g, "\n") : value.replace(/[\r\n]/g, "");
  const value = normalize(decision.mode === "slice" ? decision.value : clipboard);
  const unknownSelection = el.selectionStart === null;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const before = el.value.slice(0, start);
  const suffix = el.value.slice(end);
  const room = max >= 0 ? Math.max(0, max - before.length - suffix.length) : value.length;
  if (decision.mode === "slice") {
    // A shortened URL or answer is a different value. Keep the field intact.
    if (value.length > room) return false;
    const expected = before + value + suffix;
    insertValue(el, value);
    return unknownSelection ? el.value.includes(value) : el.value === expected;
  }
  const inserted = prefix(value, room);
  insertValue(el, inserted);
  return unknownSelection ? el.value.includes(inserted.trim()) : el.value === before + inserted + suffix;
}
