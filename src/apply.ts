import { insertValue } from "./insert";
import type { Decision } from "./types";

function cap(el: HTMLInputElement | HTMLTextAreaElement, value: string): string {
  const max = el.maxLength;
  if (max > 0 && max < 500_000 && value.length > max) return value.slice(0, max);
  return value;
}

export function applyPaste(
  el: HTMLInputElement | HTMLTextAreaElement,
  decision: Decision,
  clipboard: string,
): void {
  if (decision.mode === "slice") {
    insertValue(el, cap(el, decision.value));
    return;
  }
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  const empty = el.value.length === 0;
  const allSelected = !empty && start === 0 && end === el.value.length;
  if (!empty && !allSelected && start === end) return;
  if (empty || allSelected) {
    insertValue(el, cap(el, clipboard));
    return;
  }
  insertValue(el, cap(el, el.value.slice(0, start) + clipboard + el.value.slice(end)));
}
