import { afterEach, describe, expect, it, vi } from "vitest";
import { installPaste } from "../src/paste";
import type { Decision } from "../src/types";

let controller: ReturnType<typeof installPaste>;
afterEach(() => { controller?.dispose(); vi.useRealTimers(); document.body.innerHTML = ""; });

function mount(decide: () => Promise<Decision>, timeoutMs?: number): HTMLInputElement {
  document.body.innerHTML = '<form><label>Email<input type="email" id="email"></label></form>';
  const el = document.querySelector<HTMLInputElement>("input")!;
  el.focus();
  controller = installPaste({ enabled: () => true, decide, timeoutMs });
  return el;
}

// Unit driver models Chrome's trusted event. Browser verification uses real Ctrl+V.
function paste(el: HTMLInputElement, text: string, trusted = true): { prevented: boolean } {
  const state = { prevented: false };
  controller.handlePaste({
    isTrusted: trusted, defaultPrevented: false, target: el,
    composedPath: () => [el],
    clipboardData: { types: ["text/plain"], getData: () => text },
    preventDefault: () => { state.prevented = true; }, stopImmediatePropagation: () => {},
  } as unknown as ClipboardEvent);
  return state;
}

function deferred(): { promise: Promise<Decision>; resolve: (decision: Decision) => void } {
  let resolve!: (decision: Decision) => void;
  const promise = new Promise<Decision>((done) => { resolve = done; });
  return { promise, resolve };
}
const tick = async (): Promise<void> => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const answer = (value: string): Decision => ({ mode: "slice", value, reason: "test" });

describe("paste lifecycle", () => {
  it("does not let a page synthesize pastes to read the vault", async () => {
    const decide = vi.fn(async () => answer("private@example.com"));
    const el = mount(decide);
    expect(paste(el, "probe", false).prevented).toBe(false);
    await tick();
    expect(decide).not.toHaveBeenCalled();
    expect(el.value).toBe("");
  });

  it("uses a matching trusted paste", async () => {
    const el = mount(async () => answer("hello@example.com"));
    expect(paste(el, "Email: hello@example.com").prevented).toBe(true);
    await tick();
    expect(el.value).toBe("hello@example.com");
  });

  it("ignores older replies that arrive after a newer paste", async () => {
    const first = deferred(); const second = deferred();
    const el = mount(vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise));
    paste(el, "first"); paste(el, "second");
    second.resolve(answer("second@example.com")); await tick();
    first.resolve(answer("first@example.com")); await tick();
    expect(el.value).toBe("second@example.com");
  });

  it("keeps user edits even when the value is changed back before the reply", async () => {
    const pending = deferred(); const el = mount(() => pending.promise);
    paste(el, "Email: old@example.com");
    el.value = "typing"; el.dispatchEvent(new Event("input", { bubbles: true })); el.value = "";
    pending.resolve(answer("old@example.com")); await tick();
    expect(el.value).toBe("");
  });

  it("does not write after the user moves to another field", async () => {
    const pending = deferred(); const el = mount(() => pending.promise);
    paste(el, "Email: old@example.com");
    const next = document.createElement("input"); document.body.append(next); next.focus();
    pending.resolve(answer("old@example.com")); await tick();
    expect(el.value).toBe(""); expect(document.activeElement).toBe(next);
  });

  it("does not write after selection, disabled state, or settings change", async () => {
    for (const change of [(el: HTMLInputElement) => { el.disabled = true; }, () => controller.cancelPending()]) {
      controller?.dispose();
      const pending = deferred(); const el = mount(() => pending.promise);
      paste(el, "Email: old@example.com"); change(el);
      pending.resolve(answer("old@example.com")); await tick(); expect(el.value).toBe("");
    }
  });

  it("bypasses extraction while Shift is pressed, then resumes", async () => {
    const decide = vi.fn(async () => answer("saved@example.com")); const el = mount(decide);
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "V", ctrlKey: true, shiftKey: true, bubbles: true }));
    expect(paste(el, "whole chunk").prevented).toBe(false); expect(decide).not.toHaveBeenCalled();
    el.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift", bubbles: true }));
    paste(el, "Email: saved@example.com"); await tick(); expect(el.value).toBe("saved@example.com");
  });

  it("falls back within a bounded deadline and ignores a late response", async () => {
    vi.useFakeTimers(); const pending = deferred(); const el = mount(() => pending.promise, 25);
    paste(el, "whole clipboard"); await vi.advanceTimersByTimeAsync(25);
    expect(el.value).toBe("whole clipboard");
    pending.resolve(answer("late@example.com")); await tick(); expect(el.value).toBe("whole clipboard");
  });

  it("recovers from an unavailable worker", async () => {
    const el = mount(async () => { throw new Error("unloaded"); });
    paste(el, "whole clipboard"); await tick(); expect(el.value).toBe("whole clipboard");
  });

  it("ignores an empty clipboard and preserves native rich-only pastes", () => {
    const decide = vi.fn(async () => answer("saved@example.com")); const el = mount(decide);
    expect(paste(el, "").prevented).toBe(false); expect(decide).not.toHaveBeenCalled();
  });
});
