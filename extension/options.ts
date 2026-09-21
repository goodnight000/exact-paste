const key = document.querySelector<HTMLInputElement>("#key");
const enabled = document.querySelector<HTMLInputElement>("#enabled");
const enabledLabel = document.querySelector("#enabled-label");
const note = document.querySelector("#status");
const save = document.querySelector("#save");
if (!key || !enabled || !enabledLabel || !note || !save) throw new Error("options markup");

function paintEnabled(on: boolean): void {
  enabled.checked = on;
  enabledLabel.textContent = on ? "On" : "Off";
}

chrome.storage.local.get(["apiKey", "enabled"]).then((stored) => {
  if (typeof stored.apiKey === "string") key.value = stored.apiKey;
  paintEnabled(stored.enabled !== false);
});

enabled.addEventListener("change", () => {
  const on = enabled.checked;
  paintEnabled(on);
  void chrome.storage.local.set({ enabled: on });
});

save.addEventListener("click", () => {
  void chrome.storage.local.set({ apiKey: key.value.trim() }).then(() => {
    note.textContent = key.value.trim()
      ? "Saved. Reload pages that were already open."
      : "Cleared. Using the built-in key if you built with .env.";
  });
});
