import { deepActiveElement, describeField, isSlot } from "./field";
import { applyPaste } from "./apply";
import type { Decision, FieldInfo } from "./types";

type Options = {
  enabled: () => boolean;
  decide: (text: string, field: FieldInfo) => Promise<Decision>;
  applied?: (decision: Decision, el: HTMLInputElement | HTMLTextAreaElement, written: boolean) => void;
  timeoutMs?: number;
};

export function installPaste(options: Options, doc: Document = document): {
  handlePaste: (event: ClipboardEvent) => void;
  cancelPending: () => void;
  dispose: () => void;
} {
  const pending = new WeakMap<Element, object>();
  let epoch = 0;
  let shift = false;

  const cancelPending = (): void => { epoch += 1; shift = false; };
  const keydown = (event: KeyboardEvent): void => { shift = event.shiftKey; };
  const keyup = (event: KeyboardEvent): void => { shift = event.shiftKey; };
  const invalidate = (event: Event): void => {
    const target = event.composedPath()[0] ?? event.target;
    if (target instanceof Element) pending.delete(target);
  };

  const handlePaste = (event: ClipboardEvent): void => {
    // Otherwise a page can dispatch fake pastes to read every saved profile value.
    if (!event.isTrusted || event.defaultPrevented || shift || !options.enabled()) return;
    const el = deepActiveElement(doc);
    if (!isSlot(el)) return;
    const target = event.composedPath()[0] ?? event.target;
    if (target !== el || !event.clipboardData?.types.includes("text/plain")) return;
    const text = event.clipboardData.getData("text/plain");
    if (!text) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const request = {};
    pending.set(el, request);
    const capturedEpoch = epoch;
    const value = el.value;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const maxLength = el.maxLength;
    const field = describeField(el);

    void (async () => {
      const fallback: Decision = { value: text, mode: "whole", reason: "worker" };
      let timer: ReturnType<typeof setTimeout> | undefined;
      let decision: Decision;
      try {
        decision = await Promise.race([
          options.decide(text, field),
          new Promise<Decision>((resolve) => {
            timer = setTimeout(() => resolve(fallback), options.timeoutMs ?? 5000);
          }),
        ]);
        if (!decision || typeof decision.value !== "string" ||
          !["slice", "whole"].includes(decision.mode)) decision = fallback;
      } catch {
        decision = fallback;
      } finally {
        clearTimeout(timer);
      }
      if (pending.get(el) !== request || capturedEpoch !== epoch || !options.enabled() ||
        !el.isConnected || deepActiveElement(doc) !== el || !isSlot(el) ||
        el.value !== value || el.selectionStart !== start || el.selectionEnd !== end ||
        el.maxLength !== maxLength || JSON.stringify(describeField(el)) !== JSON.stringify(field)) return;
      pending.delete(el);
      const written = applyPaste(el, decision, text);
      options.applied?.(decision, el, written);
    })();
  };

  doc.addEventListener("keydown", keydown, true);
  doc.addEventListener("keyup", keyup, true);
  doc.addEventListener("input", invalidate, true);
  doc.addEventListener("focusout", invalidate, true);
  doc.addEventListener("paste", handlePaste, true);
  doc.defaultView?.addEventListener("blur", cancelPending);
  return {
    handlePaste,
    cancelPending,
    dispose: () => {
      cancelPending();
      doc.removeEventListener("keydown", keydown, true);
      doc.removeEventListener("keyup", keyup, true);
      doc.removeEventListener("input", invalidate, true);
      doc.removeEventListener("focusout", invalidate, true);
      doc.removeEventListener("paste", handlePaste, true);
      doc.defaultView?.removeEventListener("blur", cancelPending);
    },
  };
}
