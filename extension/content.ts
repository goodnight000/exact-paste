import { deepActiveElement, describeField, isSlot } from "../src/field";
import { applyPaste } from "../src/apply";
import type { Decision, FieldInfo } from "../src/types";

let armed = false;

function mark(state: "on" | "off"): void {
  document.documentElement.dataset.exactPaste = state;
}

mark("off");

async function refreshArmed(): Promise<boolean> {
  try {
    const status = (await chrome.runtime.sendMessage({ type: "status" })) as {
      ready?: boolean;
    };
    armed = Boolean(status?.ready);
  } catch {
    armed = false;
  }
  mark(armed ? "on" : "off");
  return armed;
}

void refreshArmed();
chrome.storage.onChanged.addListener(() => {
  void refreshArmed();
});

function toast(mode: Decision["mode"], value: string): void {
  if (mode !== "slice") return;
  document.getElementById("exact-paste-toast")?.remove();
  const el = document.createElement("div");
  el.id = "exact-paste-toast";
  el.setAttribute("role", "status");
  el.textContent = value.length > 48 ? `${value.slice(0, 45)}…` : value;
  el.style.cssText =
    "position:fixed;z-index:2147483647;left:16px;bottom:16px;max-width:280px;padding:8px 10px;border-radius:6px;background:#1b1b1b;color:#e8e8e8;font:12px/1.3 ui-sans-serif,system-ui,sans-serif;box-shadow:0 4px 16px rgb(0 0 0 / 0.35);pointer-events:none";
  document.documentElement.append(el);
  window.setTimeout(() => el.remove(), 1200);
}

document.addEventListener(
  "paste",
  (event) => {
    if ("shiftKey" in event && Boolean((event as { shiftKey?: boolean }).shiftKey)) return;
    const target = deepActiveElement();
    if (!isSlot(target)) return;
    if (!armed) {
      void refreshArmed();
      return;
    }
    const text = event.clipboardData?.getData("text/plain") ?? "";
    event.preventDefault();
    event.stopImmediatePropagation();
    const field: FieldInfo = describeField(target);
    const el = target;
    void (async () => {
      let decision: Decision = { value: text, mode: "whole", reason: "fallback" };
      try {
        await refreshArmed();
        if (armed) {
          const result = (await chrome.runtime.sendMessage({
            type: "decide",
            text,
            field,
          })) as Decision | undefined;
          if (result && typeof result.value === "string") decision = result;
        }
      } catch {
        decision = { value: text, mode: "whole", reason: "worker" };
      }
      if (!el.isConnected) return;
      applyPaste(el, decision, text);
      toast(decision.mode, el.value);
    })();
  },
  { capture: true },
);
