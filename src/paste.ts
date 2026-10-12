import { deepActiveElement, describeField, isSlot } from "./field";
import { applyPaste } from "./apply";
import { candidates } from "./candidates";
import { looksSecret, shapeOk } from "./gates";
import { buildToast, placeToast, type Tone, type ToastAction } from "./toast";
import type { Decision, FieldInfo } from "./types";

type Options = {
  enabled: () => boolean;
  readClipboard: () => Promise<string>;
  decide: (text: string, field: FieldInfo, model?: boolean) => Promise<Decision>;
  modelAvailable?: () => boolean;
  timeoutMs?: number;
};

// Called only by the extension command. Ordinary paste events are never intercepted.
export function installPaste(options: Options, doc: Document = document): {
  run: () => Promise<void>; cancelPending: () => void; dispose: () => void;
} {
  let epoch = 0;
  let panel: HTMLElement | null = null;
  let anchor: Element | null = null;
  let leaving: HTMLElement | null = null;
  let target: HTMLInputElement | HTMLTextAreaElement | null = null;
  let writing = false;
  let pending = false;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  // Keyboard-driven exits are instant. A pointer dismissal or the quiet expiry fades: the panel swaps to its own id,
  // which keeps every style, and is inert at once, so it can never be clicked or found again.
  const removePanel = (fade = false): void => {
    const wasWriting = writing; writing = true;
    if (panel?.contains(deepActiveElement(doc)) && target?.isConnected) target.focus();
    leaving?.remove(); leaving = null;
    if (panel && fade && typeof panel.getAnimations === "function") {
      const old = panel; leaving = old; old.inert = true; old.id = "exact-paste-leaving";
      setTimeout(() => { old.remove(); if (leaving === old) leaving = null; }, 140);
    } else panel?.remove();
    panel = null; clearTimeout(expiry);
    writing = wasWriting;
  };
  const place = (): void => { if (panel) placeToast(panel, anchor); };
  type Action = [ToastAction["kind"], string, () => void];
  const feedback = (tone: Tone, text: string, actions: Action[] = []): void => {
    removePanel();
    anchor = target;
    panel = buildToast(doc, tone, text, actions.map(([kind, label, action]) =>
      ({ kind, label, onClick: (event: MouseEvent) => { if (event.isTrusted) action(); } })),
    // event.detail is 0 when Enter or Space pressed the button.
    { kind: "undo", label: "Dismiss", onClick: (event) => { if (event.isTrusted) removePanel(event.detail > 0); } });
    // Progress shows only if the work outlasts 150ms, so instant results never flash a spinner first.
    if (tone === "pending") { const shown = panel; shown.dataset.quiet = ""; setTimeout(() => delete shown.dataset.quiet, 150); }
    doc.documentElement.append(panel);
    place();
    if (tone === "choice") panel.focus();
    expiry = setTimeout(() => removePanel(true), actions.length ? 30_000 : 10_000);
  };
  const cancelPending = (): void => {
    epoch++;
    if (pending) feedback("info", "Smart paste cancelled because the field or settings changed.");
    else removePanel();
    pending = false; target = null;
  };
  const changed = (event: Event): void => {
    if (writing) return;
    const origin = event.composedPath()[0] ?? event.target;
    if (event.type === "input" && origin !== target) return;
    if (event.type === "focusout") {
      const next = (event as FocusEvent).relatedTarget;
      if (next instanceof Node && (next === target || panel?.contains(next))) return;
      if (origin !== target && !(origin instanceof Node && panel?.contains(origin))) return;
    }
    cancelPending();
  };
  const escape = (event: KeyboardEvent): void => {
    if (!event.isTrusted) return;
    if (event.key === "Escape" || ((event.composedPath()[0] ?? event.target) === target &&
      !["Shift", "Alt", "Control", "Meta"].includes(event.key))) cancelPending();
  };
  const pointer = (event: PointerEvent): void => {
    if (event.isTrusted && (event.composedPath()[0] ?? event.target) === target) cancelPending();
  };
  const run = async (): Promise<void> => {
    cancelPending();
    if (!options.enabled()) return;
    const el = deepActiveElement(doc);
    if (!isSlot(el)) {
      if (!doc.execCommand?.("paste")) feedback("info", "Focus an editable form field. Use Cmd+V or Ctrl+V for normal paste.");
      return;
    }
    target = el; pending = true;
    const revision = epoch;
    const before = el.value, start = el.selectionStart, end = el.selectionEnd;
    const max = el.maxLength, field = describeField(el);
    const valid = (): boolean => epoch === revision && options.enabled() && el.isConnected && isSlot(el) &&
      el.value === before && el.selectionStart === start && el.selectionEnd === end && el.maxLength === max &&
      JSON.stringify(describeField(el)) === JSON.stringify(field);
    const restoreSelection = (): void => {
      writing = true; el.focus();
      if (start !== null && end !== null) el.setSelectionRange(start, end);
      writing = false;
    };
    let text: string;
    feedback("pending", "Reading clipboard…");
    try { text = await options.readClipboard(); }
    catch { pending = false; feedback("warn", "Clipboard access is unavailable here. Use normal paste, or try an HTTPS page."); return; }
    if (!valid()) { if (revision === epoch) cancelPending(); return; }
    const insert = (decision: Decision): void => {
      if (!valid()) { feedback("warn", "The field changed. Invoke smart paste again."); return; }
      restoreSelection();
      if (!valid()) { feedback("warn", "The field changed when it received focus. Invoke smart paste again."); return; }
      writing = true;
      const written = applyPaste(el, decision, text); writing = false; pending = false;
      if (!written) { feedback("warn", "The complete value could not be inserted. Check the field limit or use normal paste."); return; }
      const after = el.value, afterStart = el.selectionStart, afterEnd = el.selectionEnd;
      const unchanged = (): boolean => revision === epoch && el.isConnected && el.value === after &&
        el.selectionStart === afterStart && el.selectionEnd === afterEnd &&
        JSON.stringify(describeField(el)) === JSON.stringify(field);
      const undo = (): void => {
        if (!unchanged()) { feedback("warn", "The field changed. Use Chrome’s undo to review your edits."); return; }
        writing = true; el.focus();
        if (unchanged()) doc.execCommand("undo");
        writing = false; removePanel();
      };
      feedback("done", decision.mode === "whole" ? "Pasted original" :
        /^(profile|vault-)/.test(decision.reason) ? "Pasted saved detail" : `Matched “${field.label || field.kind}”`,
        [["undo", "Undo", undo], ["original", "Paste original", () => {
          if (!unchanged()) { feedback("warn", "The field changed. Invoke smart paste again."); return; }
          writing = true; el.focus();
          if (unchanged()) doc.execCommand("undo");
          writing = false;
          if (el.value !== before) { feedback("warn", "Could not restore the original selection. Use normal paste."); return; }
          restoreSelection();
          if (!valid()) { feedback("warn", "The field changed. Use normal paste."); return; }
          writing = true;
          applyPaste(el, { value: text, mode: "whole", reason: "original" }, text); writing = false;
          feedback("done", "Pasted original");
        }]]);
    };
    const resolve = async (model = false): Promise<void> => {
      feedback("pending", model ? "Asking Jev…\nSending your clipboard and field labels to TypeSafe" : "Matching on this device…");
      let timer: ReturnType<typeof setTimeout> | undefined;
      let decision: Decision;
      try {
        decision = await Promise.race([options.decide(text, field, model), new Promise<Decision>((done) => {
          timer = setTimeout(() => done({ value: text, mode: "whole", reason: "timeout" }), options.timeoutMs ?? 5000);
        })]);
        if (!decision || typeof decision.value !== "string" || !["slice", "whole"].includes(decision.mode)) throw new Error("Invalid reply");
      } catch { decision = { value: text, mode: "whole", reason: "worker" }; }
      finally { clearTimeout(timer); }
      if (!valid()) { if (revision === epoch) cancelPending(); return; }
      pending = false;
      if (decision.mode === "slice" && decision.reason === "template-header") { insert(decision); return; }
      const saved = /^(profile|vault-)/.test(decision.reason);
      const values = decision.mode === "slice" ? [decision.value] :
        text.length <= 12_000 ? candidates(text).filter((item) => item.id !== "whole" && shapeOk(field, item.text)).map((item) => item.text) : [];
      const choices: Action[] = [...new Set(values)].slice(0, 5).map((value) =>
        [saved ? "saved" : "pick", saved ? "Use saved detail" : value.length > 130 ? value.slice(0, 127) + "…" : value,
          () => insert({ value, mode: "slice", reason: saved ? decision.reason : "confirmed" })]);
      choices.push(["original", "Paste original", () => insert({ value: text, mode: "whole", reason: "original" })]);
      if (!model && options.modelAvailable?.() && text && text.length <= 12_000 && !looksSecret(text) && !looksSecret(JSON.stringify(field))) {
        choices.push(["jev", "Ask Jev", () => { if (valid()) { pending = true; restoreSelection(); void resolve(true); } }]);
      }
      feedback("choice", saved ? "Saved detail available" :
        decision.mode === "slice" ? "Choose before inserting" :
        decision.reason === "timeout" ? "Matching took too long" :
        decision.reason === "worker" ? "Matching is unavailable" : "No certain match", choices);
      // A diagnostic reason contains no clipboard/profile text and is useful in browser bug reports.
      if (panel) panel.dataset.reason = decision.reason;
    };
    await resolve();
  };
  doc.addEventListener("input", changed, true);
  doc.addEventListener("focusout", changed, true);
  doc.addEventListener("keydown", escape);
  doc.addEventListener("pointerdown", pointer, true);
  doc.defaultView?.addEventListener("blur", cancelPending);
  doc.defaultView?.addEventListener("scroll", place, { capture: true, passive: true });
  doc.defaultView?.addEventListener("resize", place, { passive: true });
  return { run, cancelPending, dispose: () => {
    cancelPending(); doc.removeEventListener("input", changed, true); doc.removeEventListener("focusout", changed, true);
    doc.removeEventListener("keydown", escape); doc.removeEventListener("pointerdown", pointer, true);
    doc.defaultView?.removeEventListener("blur", cancelPending);
    doc.defaultView?.removeEventListener("scroll", place, { capture: true });
    doc.defaultView?.removeEventListener("resize", place);
    leaving?.remove();
  } };
}
