import { installPaste } from "../src/paste";
import { pasteSettingsChanged } from "../src/settings";
import type { Decision } from "../src/types";
import { deepActiveElement } from "../src/field";
let armed = false;
let jev = false;
let shortcut = "";
async function refresh(): Promise<void> {
  try {
    const state = await chrome.runtime.sendMessage({ type: "status" });
    armed = state?.enabled === true; jev = state?.jev === true;
    shortcut = (state?.shortcut ?? "").replace(/⌥/g, "Alt+").replace(/⇧/g, "Shift+").replace(/⌘/g, "Meta+").replace(/⌃/g, "Ctrl+");
  } catch { armed = false; jev = false; }
  document.documentElement.dataset.exactPaste = armed ? "on" : "off";
}
const controller = installPaste({
  enabled: () => armed,
  readClipboard: () => navigator.clipboard.readText(),
  modelAvailable: () => jev,
  decide: async (text, field, model) => chrome.runtime.sendMessage({ type: "decide", text, field, model }) as Promise<Decision>,
});
// Chrome handles registered commands before page keys. This also supports Chrome's
// headless editing path, where the browser accelerator is not dispatched.
document.addEventListener("keydown", (event) => {
  if (!event.isTrusted || event.defaultPrevented || event.repeat || event.isComposing || !armed || !shortcut) return;
  const keys = shortcut.toLowerCase().replace(/option/g, "alt").replace(/command/g, "meta").split("+");
  const key = keys[keys.length - 1];
  const code = /^\d$/.test(key ?? "") ? `Digit${key}` : `Key${key?.toUpperCase()}`;
  if (event.code !== code || event.altKey !== keys.includes("alt") ||
    event.shiftKey !== keys.includes("shift") || event.ctrlKey !== (keys.includes("ctrl") || keys.includes("control")) ||
    event.metaKey !== keys.includes("meta")) return;
  event.preventDefault(); event.stopImmediatePropagation(); void controller.run();
}, true);
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || message?.type !== "smart-paste" || !document.hasFocus()) return;
  if (deepActiveElement() instanceof HTMLIFrameElement) return;
  void controller.run().then(() => reply({ ok: true }), () => reply({ ok: false }));
  return true;
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (!pasteSettingsChanged(changes, area)) return;
  controller.cancelPending(); void refresh();
});
void refresh();
