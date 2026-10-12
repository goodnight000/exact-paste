export function insertValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  // Chrome's editing command respects the selection and creates a native undo entry.
  if (el.ownerDocument.activeElement === el || el.getRootNode() instanceof ShadowRoot) {
    if (el.ownerDocument.execCommand?.("insertText", false, value)) return;
  }
  // DOM-only environments have no editing engine. Production refuses this fallback.
  if (typeof el.ownerDocument.execCommand === "function") return;
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? el.value.length;
  const next = el.value.slice(0, start) + value + el.value.slice(end);
  if (desc?.set) desc.set.call(el, next);
  else el.value = next;
  if (el.selectionStart !== null) el.setSelectionRange(start + value.length, start + value.length);
  el.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      composed: true,
      inputType: "insertFromPaste",
      data: value,
    }),
  );
  el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
}
