const key = document.querySelector<HTMLInputElement>("#key");
const vault = document.querySelector<HTMLTextAreaElement>("#vault");
const enabled = document.querySelector<HTMLInputElement>("#enabled");
const enabledLabel = document.querySelector("#enabled-label");
const note = document.querySelector("#status");
const save = document.querySelector("#save");
if (!key || !vault || !enabled || !enabledLabel || !note || !save) throw new Error("options markup");
const onToggle = enabled;
const onLabel = enabledLabel;
const vaultBox = vault;
const keyBox = key;
const statusBox = note;

function paintEnabled(on: boolean): void {
  onToggle.checked = on;
  onLabel.textContent = on ? "On" : "Off";
}

chrome.storage.local.get(["apiKey", "enabled", "vault"]).then((stored) => {
  if (typeof stored.apiKey === "string") keyBox.value = stored.apiKey;
  if (typeof stored.vault === "string") vaultBox.value = stored.vault;
  paintEnabled(stored.enabled !== false);
});

let vaultTimer = 0;
vaultBox.addEventListener("input", () => {
  window.clearTimeout(vaultTimer);
  vaultTimer = window.setTimeout(() => {
    void chrome.storage.local.set({ vault: vaultBox.value });
  }, 250);
});

onToggle.addEventListener("change", () => {
  const on = onToggle.checked;
  paintEnabled(on);
  void chrome.storage.local.set({ enabled: on });
});

save.addEventListener("click", () => {
  void chrome.storage.local
    .set({ apiKey: keyBox.value.trim(), vault: vaultBox.value })
    .then(() => {
      statusBox.textContent = "Saved.";
    });
});
