import { isEmail, isPhone, isUrl, platformDomains, platformUrlOk, shapeOk } from "../src/gates";
import { readProfile, savedSource, vaultFrom, type Profile, type ProfileField } from "../src/profile";
import type { FieldKind } from "../src/types";

// Storage contract (chrome.storage.local):
//   enabled: boolean            — saved immediately on toggle.
//   apiKey: string              — saved on Save.
//   profile: Profile            — the editor's structured state, saved on Save.
//   vault: string               — what the worker reads. Always vaultFrom(profile), written in the same set().
// Unsaved edits live in chrome.storage.session under "optionsDraft" (memory only) so closing the popup keeps them.

type Draft = { profile: Profile; apiKey: string; useSaved: boolean };

const PRESETS: Record<string, { label: string; type: FieldKind; placeholder: string; autocomplete: string }> = {
  name: { label: "Name", type: "text", placeholder: "Ada Park", autocomplete: "name" },
  email: { label: "Email", type: "email", placeholder: "you@company.com", autocomplete: "email" },
  phone: { label: "Phone", type: "tel", placeholder: "+1 415 555 0100", autocomplete: "tel" },
  linkedin: { label: "LinkedIn", type: "url", placeholder: "https://www.linkedin.com/in/you", autocomplete: "url" },
  github: { label: "GitHub", type: "url", placeholder: "https://github.com/you", autocomplete: "url" },
  website: { label: "Website", type: "url", placeholder: "https://you.dev", autocomplete: "url" },
};

function readDraft(raw: unknown): Draft | null {
  const draft = raw as Partial<Draft> | undefined;
  const profile = readProfile(draft?.profile);
  return profile && typeof draft?.apiKey === "string" ? { profile, apiKey: draft.apiKey, useSaved: draft.useSaved === true } : null;
}

// Why a filled preset value would be refused at paste time, judged by the same gates the worker uses. Custom fields are free text.
function invalidReason(field: ProfileField): string | null {
  const preset = PRESETS[field.kind];
  const value = field.value.trim();
  if (!preset || !value) return null;
  // The placeholder is left out: a renamed preset should be judged by its label, not the example link it started with.
  const info = { label: field.label, kind: preset.type, type: preset.type, name: "", id: "", autocomplete: preset.autocomplete, placeholder: "", tag: "input", nearby: [] };
  if (shapeOk(info, value)) return null;
  const domains = platformDomains(info);
  if (domains && !platformUrlOk(info, value)) {
    return isUrl(value) ? `That isn't a ${domains.join(" or ")} link.` : `Enter a ${domains.join(" or ")} link.`;
  }
  if (preset.type === "email" && !isEmail(value)) return "That email address isn't valid.";
  if (preset.type === "url" && !isUrl(value)) return "That link isn't valid. Use an address like example.com/you.";
  if (preset.type === "tel" && !isPhone(value)) return "A phone number needs 7 to 15 digits.";
  return `That value can't be pasted as ${field.label.trim() || "this field"}.`;
}

function el<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`options markup: ${selector}`);
  return found;
}

const rows = el<HTMLUListElement>("#rows");
const notes = el<HTMLTextAreaElement>("#notes");
const key = el<HTMLInputElement>("#key");
const reveal = el<HTMLButtonElement>("#reveal");
const jevState = el<HTMLParagraphElement>("#jev-state");
const jevMeta = el<HTMLSpanElement>("#jev-meta");
const notesMeta = el<HTMLSpanElement>("#notes-meta");
const kinds = el<HTMLDivElement>("#kinds");
const bar = el<HTMLElement>("#bar");
const enabled = el<HTMLInputElement>("#enabled");
const smartLabel = el<HTMLElement>("#smart-label");
const status = el<HTMLParagraphElement>("#status");
const save = el<HTMLButtonElement>("#save");
const discard = el<HTMLButtonElement>("#discard");
const full = el<HTMLAnchorElement>("#full");
// Inert until stored settings load, so nothing typed early is overwritten and a failed load can never save over them.
const editor = el<HTMLElement>("main");

const useSaved = el<HTMLInputElement>("#use-saved");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
document.getElementById("shortcuts")!.addEventListener("click", () => void chrome.tabs.create({ url: "chrome://extensions/shortcuts" }));

const SVG = "http://www.w3.org/2000/svg";
function icon(name: string): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", "i"); svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(SVG, "use"); use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
}

const keycaps = (keys: string[]): HTMLElement[] =>
  keys.map((key) => Object.assign(document.createElement("kbd"), { textContent: key.trim(), ariaHidden: "true" }));
const mac = /Mac/.test(navigator.platform);
el("#normal-keys").replaceChildren(
  Object.assign(document.createElement("span"), { className: "sr", textContent: mac ? "Command V" : "Control V" }),
  ...keycaps(mac ? ["⌘", "V"] : ["Ctrl", "V"]));

// Chrome reports "⌥⇧V" on macOS and "Alt+Shift+V" elsewhere; both become keycaps.
void chrome.commands.getAll().then(commands => {
  const shortcut = commands.find(command => command.name === "smart-paste")?.shortcut ?? "";
  const keys = shortcut.includes("+") ? shortcut.split("+") : [...shortcut];
  const state = document.getElementById("shortcut-state")!;
  const label = Object.assign(document.createElement("span"), { className: "sr", textContent: shortcut ? `Your shortcut: ${shortcut}` : "No shortcut assigned" });
  state.replaceChildren(label, ...(shortcut
    ? keycaps(keys)
    : [Object.assign(document.createElement("span"), { className: "none", textContent: "No shortcut set", ariaHidden: "true" })]));
});
let saved: Draft = { profile: { version: 1, fields: [], notes: "" }, apiKey: "", useSaved: false };
let fields: ProfileField[] = [];
let builtInJev = false;
let saving = false;

const isPopup = chrome.extension.getViews({ type: "popup" }).includes(window);
document.body.classList.toggle("popup", isPopup);
full.hidden = !isPopup;
full.addEventListener("click", (event) => {
  event.preventDefault();
  void chrome.runtime.openOptionsPage();
  window.close();
});
el<HTMLAnchorElement>("#tutorial").addEventListener("click", (event) => {
  event.preventDefault();
  void chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
  if (isPopup) window.close();
});

function current(): Draft {
  return { profile: { version: 1, fields: fields.map((f) => ({ ...f })), notes: notes.value }, apiKey: key.value.trim(), useSaved: useSaved.checked };
}

function same(a: Draft, b: Draft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

let savedTimer = 0;
function say(text: string, tone: "" | "ok" | "bad" = ""): void {
  status.replaceChildren(...(tone && text ? [icon(tone === "ok" ? "check" : "alert")] : []), text);
  status.dataset.tone = tone;
  window.clearTimeout(savedTimer);
  // "Saved" is a confirmation, not a state: it leaves on its own so the bar can get out of the way.
  if (tone === "ok") savedTimer = window.setTimeout(() => { if (status.textContent === text && save.disabled) { say(""); paintBar(); } }, 2400);
  paintBar();
}

function paintBar(): void {
  const shown = !save.disabled || saving || !!status.textContent;
  bar.toggleAttribute("data-shown", shown);
  bar.inert = !shown;
}

function paintEnabled(on: boolean): void {
  enabled.checked = on;
  smartLabel.textContent = on ? "Smart paste once" : "Smart paste is off";
  document.getElementById("shortcut")!.toggleAttribute("data-off", !on);
  // Off is the one state worth surfacing: the switch to turn it back on stays in view.
  if (!on) el<HTMLDetailsElement>("#shortcut-more").open = true;
}

function paintJev(): void {
  const typed = key.value.trim();
  if (typed && typed !== saved.apiKey) { jevState.textContent = "Save to use this key."; jevMeta.textContent = "Unsaved key"; }
  else if (saved.apiKey) { jevState.textContent = "Available when you choose Ask Jev. Nothing is sent automatically."; jevMeta.textContent = "Key saved"; }
  else if (builtInJev) { jevState.textContent = "Using the built-in key. Jev is used when on-device matching is unsure."; jevMeta.textContent = "Built-in key"; }
  else { jevState.textContent = ""; jevMeta.textContent = "Optional"; }
}

let draftTimer = 0;
function writeDraft(): void {
  window.clearTimeout(draftTimer);
  // Before load, the empty form would match the empty default and delete the stored draft.
  if (editor.inert) return;
  const draft = current();
  const write = same(draft, saved)
    ? chrome.storage.session.remove("optionsDraft")
    : chrome.storage.session.set({ optionsDraft: draft });
  write.catch(() => say("Unsaved changes won't survive closing this window. Save to keep them.", "bad"));
}

function changed(): void {
  const dirty = !same(current(), saved);
  save.disabled = !dirty || saving;
  discard.hidden = !dirty;
  const lines = notes.value.trim() ? notes.value.trim().split("\n").length : 0;
  notesMeta.textContent = lines ? `${lines} ${lines === 1 ? "line" : "lines"}` : "Empty";
  if (dirty && status.dataset.tone !== "bad") say("Unsaved changes");
  if (!dirty && status.textContent === "Unsaved changes") say("");
  paintBar();
  paintJev();
  window.clearTimeout(draftTimer);
  draftTimer = window.setTimeout(writeDraft, 150);
}

function paintAddButtons(): void {
  for (const button of kinds.querySelectorAll<HTMLButtonElement>("button[data-kind]")) {
    const kind = button.dataset.kind ?? "custom";
    button.hidden = kind !== "custom" && fields.some((f) => f.kind === kind);
  }
}

function renderRows(focusIndex?: number, focusPart: "name" | "value" = "value", entering?: number): void {
  rows.replaceChildren();
  if (!fields.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "Nothing saved yet.";
    rows.append(empty);
  }
  fields.forEach((field, index) => {
    const preset = PRESETS[field.kind];
    const li = document.createElement("li");
    if (index === entering) li.className = "enter";

    const name = document.createElement("input");
    name.className = "name";
    name.value = field.label;
    name.placeholder = "Label";
    name.setAttribute("aria-label", `Label for field ${index + 1}`);

    const value: HTMLInputElement | HTMLTextAreaElement = preset
      ? Object.assign(document.createElement("input"), { type: preset.type, autocomplete: "off", placeholder: preset.placeholder })
      : Object.assign(document.createElement("textarea"), { rows: 1, placeholder: "Value, one or more lines" });
    value.className = "value";
    value.value = field.value;
    value.spellcheck = !preset || preset.type === "text";
    value.setAttribute("aria-label", field.label || "Value");

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-btn";
    remove.append(icon("close"));
    remove.setAttribute("aria-label", `Remove ${field.label || "field"}`);
    remove.title = "Remove";

    // An edit either way can fix the row, so it drops the row's markers and the error that pointed at them.
    const clearInvalid = (): void => {
      if (!li.querySelector("[aria-invalid]")) return;
      name.removeAttribute("aria-invalid");
      value.removeAttribute("aria-invalid");
      if (status.dataset.tone === "bad") say("");
    };
    name.addEventListener("input", () => {
      field.label = name.value;
      clearInvalid();
      value.setAttribute("aria-label", field.label || "Value");
      remove.setAttribute("aria-label", `Remove ${field.label || "field"}`);
      changed();
    });
    value.addEventListener("input", () => {
      field.value = value.value;
      clearInvalid();
      changed();
    });
    remove.addEventListener("click", () => {
      // The data changes now; only the row's exit waits. Any re-render (add, save, discard) ends the exit early.
      const at = fields.indexOf(field);
      if (at < 0) return;
      fields.splice(at, 1);
      paintAddButtons();
      changed();
      const next = (): void => {
        renderRows(Math.min(at, fields.length - 1));
        if (!fields.length) el<HTMLButtonElement>("#add").focus();
      };
      if (reduceMotion.matches) { next(); return; }
      li.dataset.leaving = "";
      li.inert = true;
      window.setTimeout(() => { if (li.isConnected) next(); }, 140);
    });

    const stack = document.createElement("div");
    stack.className = "stack";
    stack.append(name, value);
    li.append(icon(preset ? field.kind : "custom"), stack, remove);
    rows.append(li);
    if (index === focusIndex) (focusPart === "name" ? name : value).focus();
  });
}

for (const button of kinds.querySelectorAll<HTMLButtonElement>("button[data-kind]")) {
  button.addEventListener("click", () => {
    const kind = button.dataset.kind ?? "custom";
    kinds.hidePopover();
    fields.push({ kind, label: PRESETS[kind]?.label ?? "", value: "" });
    renderRows(fields.length - 1, kind === "custom" ? "name" : "value", fields.length - 1);
    paintAddButtons();
    changed();
  });
}

function load(state: Draft): void {
  fields = state.profile.fields.map((f) => ({ ...f }));
  notes.value = state.profile.notes;
  key.value = state.apiKey;
  useSaved.checked = state.useSaved;
  renderRows();
  paintAddButtons();
  changed();
}

async function commit(): Promise<void> {
  if (saving || save.disabled) return;
  // Rows are matched to fields by position below, so a row still fading out must leave first.
  if (rows.querySelector("[data-leaving]")) renderRows();
  const missing = fields.findIndex((f) => f.value.trim() && !f.label.trim());
  if (missing >= 0) {
    const name = rows.children[missing]?.querySelector<HTMLInputElement>(".name");
    name?.setAttribute("aria-invalid", "true");
    name?.focus();
    say("Give that field a label so it can be matched.", "bad");
    return;
  }
  for (const [index, field] of fields.entries()) {
    const reason = invalidReason(field);
    if (!reason) continue;
    const value = rows.children[index]?.querySelector<HTMLInputElement>(".value");
    value?.setAttribute("aria-invalid", "true");
    value?.focus();
    say(reason, "bad");
    return;
  }
  const next = current();
  saving = true;
  save.disabled = true;
  save.textContent = "Saving…";
  save.setAttribute("aria-busy", "true");
  paintBar();
  try {
    await chrome.storage.local.set({ profile: next.profile, vault: vaultFrom(next.profile), apiKey: next.apiKey, useSaved: next.useSaved });
    saved = next;
    say("Saved", "ok");
    // Edits made while saving stay in the draft; otherwise this clears it.
    writeDraft();
  } catch (error) {
    say(`Not saved: ${error instanceof Error ? error.message : String(error)}`, "bad");
  } finally {
    saving = false;
    save.textContent = "Save";
    save.removeAttribute("aria-busy");
    changed();
  }
}

notes.addEventListener("input", changed);
key.addEventListener("input", changed);
useSaved.addEventListener("change", changed);
save.addEventListener("click", () => void commit());
discard.addEventListener("click", () => {
  load(saved);
  say("Changes discarded");
  chrome.storage.session.remove("optionsDraft").catch(() => undefined);
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    void commit();
  }
});
// The popup can close at any moment; flush the pending draft write instead of waiting on the timer.
window.addEventListener("pagehide", writeDraft);

reveal.addEventListener("click", () => {
  const show = key.type === "password";
  key.type = show ? "text" : "password";
  reveal.replaceChildren(icon(show ? "eye-off" : "eye"));
  reveal.setAttribute("aria-label", show ? "Hide key" : "Show key");
  reveal.title = show ? "Hide key" : "Show key";
  reveal.setAttribute("aria-pressed", String(show));
});

enabled.addEventListener("change", () => {
  paintEnabled(enabled.checked);
  chrome.storage.local.set({ enabled: enabled.checked }).catch(() => {
    paintEnabled(!enabled.checked);
    say("Could not change on/off.", "bad");
  });
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.enabled) paintEnabled(changes.enabled.newValue !== false);
});

void (async () => {
  try {
    const stored = await chrome.storage.local.get(["apiKey", "enabled", "vault", "profile", "useSaved"]);
    paintEnabled(stored.enabled !== false);
    const source = savedSource(stored);
    saved = {
      profile: { version: 1, fields: source.fields ?? [], notes: source.text },
      apiKey: typeof stored.apiKey === "string" ? stored.apiKey.trim() : "",
      useSaved: stored.useSaved === true,
    };
    // Structured fields that no longer produce the saved vault are dropped: the vault is what pastes, so it becomes notes.
    const drifted = stored.profile !== undefined && !source.fields && source.text !== "";
    // Drafts are a convenience; an unreadable one is ignored rather than blocking the saved settings.
    const draft = readDraft(await chrome.storage.session.get("optionsDraft").then((s) => s.optionsDraft, () => null));
    editor.inert = false;
    if (draft && !same(draft, saved)) {
      load(draft);
      say("Restored unsaved changes");
    } else {
      load(saved);
      if (drifted) {
        el<HTMLDetailsElement>("#notes-more").open = true;
        say("Saved text changed elsewhere and is shown under Long answers. Review, then save.");
      }
    }
    if (!saved.apiKey) {
      // With no saved key, any key the worker reports is the built-in one.
      chrome.runtime.sendMessage({ type: "status" }).then((reply: { jev?: unknown } | undefined) => {
        builtInJev = reply?.jev === true;
        paintJev();
      }, () => undefined);
    }
  } catch (error) {
    say(`Could not load settings: ${error instanceof Error ? error.message : String(error)}`, "bad");
  }
})();
