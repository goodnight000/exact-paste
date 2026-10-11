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
  if (decision.mode === "slice") {
    const value = normalize(decision.value);
    // A shortened URL or answer is a different value. Keep the field intact.
    if (max >= 0 && value.length > max) return false;
    insertValue(el, value);
    return el.value === value;
  }
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  const empty = el.value.length === 0;
  const allSelected = !empty && start === 0 && end === el.value.length;
  if (!empty && !allSelected && start === end) return false;
  if (empty || allSelected) {
    const value = normalize(clipboard);
    insertValue(el, max >= 0 ? prefix(value, max) : value);
    return true;
  }
  const before = el.value.slice(0, start);
  const suffix = el.value.slice(end);
  const room = max >= 0 ? Math.max(0, max - before.length - suffix.length) : clipboard.length;
  insertValue(el, before + prefix(normalize(clipboard), room) + suffix);
  return true;
}
