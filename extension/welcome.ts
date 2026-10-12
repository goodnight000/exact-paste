import { installPaste } from "../src/paste";
import { resolvePaste } from "../src/resolve";
import { pasteSettingsChanged } from "../src/settings";

// The tutorial runs the real smart-paste controller and on-device matcher. Content scripts never inject
// extension pages, so the worker routes the command here as "tutorial-smart-paste". Saved details and Jev
// are left out on purpose: the practice shows what the clipboard alone produces.
const SAMPLE = "Name\nMara Lindqvist\n\nEmail\nmara.lindqvist@example.com";
const EMAIL = "mara.lindqvist@example.com";

function el<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`welcome markup: ${selector}`);
  return found;
}

const email = el<HTMLInputElement>("#email");
const clear = el<HTMLButtonElement>("#clear");
const copy = el<HTMLButtonElement>("#copy");
const how = el<HTMLParagraphElement>("#how");
const status = el<HTMLParagraphElement>("#status");
const turnOn = el<HTMLButtonElement>("#turn-on");
el("#sample").textContent = SAMPLE;

const SVG = "http://www.w3.org/2000/svg";
function icon(name: string): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", "i"); svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(SVG, "use"); use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
}
const span = (className: string, textContent: string): HTMLSpanElement => Object.assign(document.createElement("span"), { className, textContent });
const keycaps = (keys: string[]): HTMLElement[] =>
  keys.map((key) => Object.assign(document.createElement("kbd"), { textContent: key.trim(), ariaHidden: "true" }));
// Chrome reports "⌥⇧V" on macOS and "Alt+Shift+V" elsewhere.
const keysOf = (shortcut: string): string[] => shortcut.includes("+") ? shortcut.split("+") : [...shortcut];
const mac = /Mac/.test(navigator.platform);
const normal = mac ? ["⌘", "V"] : ["Ctrl", "V"];
el("#normal-keys").replaceChildren(span("sr", mac ? "Command V" : "Control V"), ...keycaps(normal));

function say(text: string, tone: "" | "ok" | "bad" = ""): void {
  status.replaceChildren(...(tone && text ? [icon(tone === "ok" ? "check" : "alert")] : []), text);
  status.dataset.tone = tone;
}

let armed = false;
let shortcut = "";
let loaded = false;

const controller = installPaste({
  enabled: () => armed,
  readClipboard: () => navigator.clipboard.readText(),
  modelAvailable: () => false,
  decide: (text, field) => resolvePaste(text, "", field, null, []),
});

function paint(): void {
  const keys = el("#smart-keys");
  keys.replaceChildren(...(shortcut
    ? [span("sr", `Your shortcut: ${shortcut}`), ...keycaps(keysOf(shortcut))]
    : [span("none", "No shortcut set")]));
  el("#shortcut").toggleAttribute("data-off", !armed);
  el("#smart-label").textContent = armed ? "Smart paste, once" : "Smart paste is off";
  turnOn.hidden = armed;
  if (!loaded) how.replaceChildren();
  else if (!shortcut) how.replaceChildren("Assign a shortcut, then press it in this field.");
  else if (!armed) how.replaceChildren("Turn smart paste on to practice here.");
  else how.replaceChildren("Click here, press", ...keycaps(keysOf(shortcut)), "then", ...keycaps(normal), "to compare.");
}

async function refresh(): Promise<void> {
  try {
    const state = await chrome.runtime.sendMessage({ type: "status" });
    armed = state?.enabled === true;
    shortcut = typeof state?.shortcut === "string" ? state.shortcut : "";
    loaded = true;
    if (status.textContent?.startsWith("Could not read your shortcut")) say("");
  } catch (error) {
    armed = false; loaded = false;
    say(`Could not read your shortcut: ${error instanceof Error ? error.message : String(error)}`, "bad");
  }
  paint();
}

// Chrome normally consumes its registered shortcut and the worker routes it here. This catches the key when the
// accelerator is not dispatched, with the same matching as extension/content.ts.
document.addEventListener("keydown", (event) => {
  if (!event.isTrusted || event.defaultPrevented || event.repeat || event.isComposing || !armed || !shortcut) return;
  const keys = shortcut.replace(/⌥/g, "Alt+").replace(/⇧/g, "Shift+").replace(/⌘/g, "Meta+").replace(/⌃/g, "Ctrl+")
    .toLowerCase().replace(/option/g, "alt").replace(/command/g, "meta").split("+");
  const key = keys[keys.length - 1];
  const code = /^\d$/.test(key ?? "") ? `Digit${key}` : `Key${key?.toUpperCase()}`;
  if (event.code !== code || event.altKey !== keys.includes("alt") ||
    event.shiftKey !== keys.includes("shift") || event.ctrlKey !== (keys.includes("ctrl") || keys.includes("control")) ||
    event.metaKey !== keys.includes("meta")) return;
  event.preventDefault(); event.stopImmediatePropagation(); void controller.run();
}, true);
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || message?.type !== "tutorial-smart-paste" || !document.hasFocus()) return;
  void controller.run().then(() => reply({ ok: true }), () => reply({ ok: false }));
  return true;
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (!pasteSettingsChanged(changes, area)) return;
  controller.cancelPending(); void refresh();
});
// A shortcut changed in chrome://extensions/shortcuts fires no storage event; recheck on return.
window.addEventListener("focus", () => void refresh());

let copiedTimer = 0;
copy.addEventListener("click", (event) => {
  if (!event.isTrusted) return;
  navigator.clipboard.writeText(SAMPLE).then(() => {
    copy.dataset.copied = "";
    copy.replaceChildren(icon("check"), span("", "Copied"));
    window.clearTimeout(copiedTimer);
    copiedTimer = window.setTimeout(() => { delete copy.dataset.copied; copy.replaceChildren(icon("copy"), span("", "Copy")); }, 2000);
    say("");
    email.focus();
  }, (error) => say(`Could not copy: ${error instanceof Error ? error.message : String(error)}. Select the sample and copy it yourself.`, "bad"));
});

// What landed in the field tells which paste ran: the email alone, or the whole sample flattened onto one line.
email.addEventListener("input", () => {
  const value = email.value.trim();
  clear.hidden = !email.value;
  el("#practice-row").toggleAttribute("data-done", value === EMAIL);
  if (value === EMAIL) {
    say("Only the email went in. Normal paste would have brought everything you copied.", "ok");
    el("#skip").textContent = "Done";
  }
  else if (value.includes("Lindqvist")) say("That was normal paste: the whole copy went in. Clear the field and try your shortcut.");
  else say("");
});
clear.addEventListener("click", () => {
  email.value = "";
  email.dispatchEvent(new Event("input"));
  email.focus();
});
el("#practice-row").addEventListener("submit", (event) => event.preventDefault());

turnOn.addEventListener("click", () => {
  chrome.storage.local.set({ enabled: true }).catch(() => say("Could not turn smart paste on. Try again from Settings.", "bad"));
});
el("#change").addEventListener("click", () => void chrome.tabs.create({ url: "chrome://extensions/shortcuts" }));
el("#settings").addEventListener("click", () => void chrome.runtime.openOptionsPage());
el("#skip").addEventListener("click", () => {
  void chrome.tabs.getCurrent().then((tab) => tab?.id === undefined ? window.close() : chrome.tabs.remove(tab.id));
});

void refresh();
