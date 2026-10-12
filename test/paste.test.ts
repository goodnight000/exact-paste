import { afterEach, describe, expect, it, vi } from "vitest";
import { installPaste } from "../src/paste";
import type { Decision } from "../src/types";
let controller: ReturnType<typeof installPaste>;
afterEach(() => { controller?.dispose(); vi.useRealTimers(); document.body.innerHTML = ""; });
function mount(decide: () => Promise<Decision>, readClipboard = async () => "Email: copied@example.com", timeoutMs?: number) {
  document.body.innerHTML = '<form><label>Email<input type="email" id="email"></label><label>Next<input id="next"></label></form>';
  const el = document.querySelector<HTMLInputElement>("#email")!; el.focus();
  controller = installPaste({ enabled: () => true, readClipboard, decide, timeoutMs });
  return el;
}
function deferred() {
  let resolve!: (decision: Decision) => void;
  const promise = new Promise<Decision>(done => { resolve = done; }); return {promise,resolve};
}
const answer = (value: string): Decision => ({mode:"slice",value,reason:"template-header"});
describe("one-shot smart paste", () => {
  it("leaves genuine and synthetic normal paste events untouched", async () => {
    const decide = vi.fn(async () => answer("private@example.com")); const read = vi.fn(async()=>"probe");
    const el = mount(decide,read); const event = new Event("paste",{bubbles:true,cancelable:true});
    el.dispatchEvent(event); expect(event.defaultPrevented).toBe(false); expect(decide).not.toHaveBeenCalled(); expect(read).not.toHaveBeenCalled();
  });
  it("reads once on invocation and inserts an exact matching header", async () => {
    const read=vi.fn(async()=>"Email: copied@example.com"); const el=mount(async()=>answer("copied@example.com"),read);
    await controller.run(); expect(read).toHaveBeenCalledTimes(1); expect(el.value).toBe("copied@example.com");
  });
  it("offers an inferred match without writing it", async () => {
    const el=mount(async()=>({value:"support@example.com",mode:"slice",reason:"one-email"}));
    await controller.run(); expect(el.value).toBe(""); expect(document.querySelector('#exact-paste-toast')?.textContent).toContain('Choose before inserting');
    document.querySelector<HTMLButtonElement>('#exact-paste-toast button')!.click(); expect(el.value).toBe("");
  });
  it("does not let an older reply overwrite the newer invocation", async () => {
    const first=deferred(),second=deferred(); const el=mount(vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise));
    const old=controller.run(); await Promise.resolve(); const latest=controller.run(); await Promise.resolve();
    second.resolve(answer('new@example.com')); await latest; first.resolve(answer('old@example.com')); await old; expect(el.value).toBe('new@example.com');
  });
  it("keeps user edits even when the value is changed back", async () => {
    const pending=deferred(); const el=mount(()=>pending.promise); const task=controller.run(); await Promise.resolve();
    el.value='typing'; el.dispatchEvent(new Event('input',{bubbles:true})); el.value=''; pending.resolve(answer('old@example.com')); await task; expect(el.value).toBe('');
  });
  it("cancels after Tab with a visible result", async () => {
    const pending=deferred(); const el=mount(()=>pending.promise); const task=controller.run(); await Promise.resolve();
    document.getElementById('next')!.focus(); pending.resolve(answer('old@example.com')); await task;
    expect(el.value).toBe(''); expect(document.querySelector('#exact-paste-toast')?.textContent).toContain('cancelled');
  });
  it("cancels after settings or field metadata changes", async () => {
    for (const change of [() => controller.cancelPending(), () => document.querySelector('label')!.firstChild!.textContent='Work email']) {
      controller?.dispose(); const pending=deferred(); const el=mount(()=>pending.promise); const task=controller.run(); await Promise.resolve();
      change(); pending.resolve(answer('old@example.com')); await task; expect(el.value).toBe('');
    }
  });
  it("does not write after disabling or removing the field", async () => {
    const pending=deferred(); const el=mount(()=>pending.promise); const task=controller.run(); await Promise.resolve();
    el.disabled=true; pending.resolve(answer('old@example.com')); await task; expect(el.value).toBe('');
  });
  it("bounds a timeout and requires a choice instead of dumping the clipboard", async () => {
    vi.useFakeTimers(); const pending=deferred(); const el=mount(()=>pending.promise,async()=>"whole clipboard",25);
    const task=controller.run(); await vi.advanceTimersByTimeAsync(25); await task;
    expect(el.value).toBe(''); expect(document.querySelector('#exact-paste-toast')?.textContent).toContain('Paste original');
    pending.resolve(answer('late@example.com')); await Promise.resolve(); expect(el.value).toBe('');
  });
  it("handles unavailable clipboard and worker without deleting a value", async () => {
    const el=mount(async()=>{throw new Error('worker')}); el.value='old@example.com'; await controller.run(); expect(el.value).toBe('old@example.com');
    controller.dispose(); const next=mount(async()=>answer('saved@example.com'),async()=>{throw new Error('clipboard')}); await controller.run();
    expect(next.value).toBe(''); expect(document.querySelector('#exact-paste-toast')?.textContent).toContain('unavailable');
  });
});
