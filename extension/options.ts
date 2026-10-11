import { isEmail, isPhone, isUrl, platformDomains, platformUrlOk, shapeOk } from "../src/gates";
import { readProfile, savedSource, vaultFrom, type Profile, type ProfileField } from "../src/profile";
import type { FieldKind } from "../src/types";

// Storage contract (chrome.storage.local):
//   enabled: boolean            — saved immediately on toggle.
//   apiKey: string              — saved on Save.
//   profile: Profile            — the editor's structured state, saved on Save.
//   vault: string               — what the worker reads. Always vaultFrom(profile), written in the same set().
// Unsaved edits live in chrome.storage.session under "optionsDraft" (memory only) so closing the popup keeps them.

type Draft = { profile: Profile; apiKey: string };

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
  return profile && typeof draft?.apiKey === "string" ? { profile, apiKey: draft.apiKey } : null;
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
const preview = el<HTMLPreElement>("#preview");
const enabled = el<HTMLInputElement>("#enabled");
const enabledLabel = el<HTMLSpanElement>("#enabled-label");
const status = el<HTMLParagraphElement>("#status");
const save = el<HTMLButtonElement>("#save");
const discard = el<HTMLButtonElement>("#discard");
const full = el<HTMLAnchorElement>("#full");
// Inert until stored settings load, so nothing typed early is overwritten and a failed load can never save over them.
const editor = el<HTMLElement>("main");

let saved: Draft = { profile: { version: 1, fields: [], notes: "" }, apiKey: "" };
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

function current(): Draft {
  return { profile: { version: 1, fields: fields.map((f) => ({ ...f })), notes: notes.value }, apiKey: key.value.trim() };
}

function same(a: Draft, b: Draft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function say(text: string, tone: "" | "ok" | "bad" = ""): void {
  status.textContent = text;
  status.dataset.tone = tone;
}

function paintEnabled(on: boolean): void {
  enabled.checked = on;
  enabledLabel.textContent = on ? "On" : "Off";
}

function paintJev(): void {
  const typed = key.value.trim();
  if (typed && typed !== saved.apiKey) jevState.textContent = "Save to use this key.";
  else if (saved.apiKey) jevState.textContent = "Jev is used when on-device matching is unsure.";
  else if (builtInJev) jevState.textContent = "Using the built-in key. Jev is used when on-device matching is unsure.";
  else jevState.textContent = "";
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
  preview.textContent = vaultFrom(current().profile) || "Nothing saved yet.";
  if (dirty && status.dataset.tone !== "bad") say("Unsaved changes");
  if (!dirty && status.textContent === "Unsaved changes") say("");
  paintJev();
  window.clearTimeout(draftTimer);
  draftTimer = window.setTimeout(writeDraft, 150);
}

function paintAddButtons(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>(".add button")) {
    const kind = button.dataset.kind ?? "custom";
    button.hidden = kind !== "custom" && fields.some((f) => f.kind === kind);
  }
}

function renderRows(focusIndex?: number, focusPart: "name" | "value" = "value"): void {
  rows.replaceChildren();
  if (!fields.length) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No details yet. Add the ones you paste often.";
    rows.append(empty);
  }
  fields.forEach((field, index) => {
    const preset = PRESETS[field.kind];
    const li = document.createElement("li");

    const name = document.createElement("input");
    name.className = "name";
    name.value = field.label;
    name.placeholder = "Label";
    name.setAttribute("aria-label", `Label for field ${index + 1}`);

    const value: HTMLInputElement | HTMLTextAreaElement = preset
      ? Object.assign(document.createElement("input"), { type: preset.type, autocomplete: "off", placeholder: preset.placeholder })
      : Object.assign(document.createElement("textarea"), { rows: 1, placeholder: "Value (can be several lines)" });
    value.className = "value";
    value.value = field.value;
    value.spellcheck = !preset || preset.type === "text";
    value.setAttribute("aria-label", field.label || "Value");

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remove ${field.label || "field"}`);

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
      fields.splice(index, 1);
      renderRows(Math.min(index, fields.length - 1));
      paintAddButtons();
      if (!fields.length) document.querySelector<HTMLButtonElement>(".add button:not([hidden])")?.focus();
      changed();
    });

    li.append(name, value, remove);
    rows.append(li);
    if (index === focusIndex) (focusPart === "name" ? name : value).focus();
  });
}

for (const button of document.querySelectorAll<HTMLButtonElement>(".add button")) {
  button.addEventListener("click", () => {
    const kind = button.dataset.kind ?? "custom";
    fields.push({ kind, label: PRESETS[kind]?.label ?? "", value: "" });
    renderRows(fields.length - 1, kind === "custom" ? "name" : "value");
    paintAddButtons();
    changed();
  });
}

function load(state: Draft): void {
  fields = state.profile.fields.map((f) => ({ ...f }));
  notes.value = state.profile.notes;
  key.value = state.apiKey;
  renderRows();
  paintAddButtons();
  changed();
}

async function commit(): Promise<void> {
  if (saving || save.disabled) return;
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
  try {
    await chrome.storage.local.set({ profile: next.profile, vault: vaultFrom(next.profile), apiKey: next.apiKey });
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
  reveal.textContent = show ? "Hide" : "Show";
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
    const stored = await chrome.storage.local.get(["apiKey", "enabled", "vault", "profile"]);
    paintEnabled(stored.enabled !== false);
    const source = savedSource(stored);
    saved = {
      profile: { version: 1, fields: source.fields ?? [], notes: source.text },
      apiKey: typeof stored.apiKey === "string" ? stored.apiKey.trim() : "",
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
      if (drifted) say("Saved text was changed elsewhere and is shown under notes. Review, then save.");
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
