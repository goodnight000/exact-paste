import { installPaste } from "../src/paste";
import type { Decision } from "../src/types";

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
  controller.cancelPending();
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

const controller = installPaste({
  enabled: () => armed,
  decide: async (text, field) => chrome.runtime.sendMessage({ type: "decide", text, field }) as Promise<Decision>,
  applied: (decision, el, written) => {
    if (written) toast(decision.mode, el.value);
    else if (decision.mode === "slice" && el.maxLength >= 0 && decision.value.length > el.maxLength) {
      toast("slice", "Too long for this field. Nothing pasted.");
    }
  },
});
