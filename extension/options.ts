const key = document.querySelector<HTMLInputElement>("#key");
const note = document.querySelector("#status");
const save = document.querySelector("#save");
if (!key || !note || !save) throw new Error("options markup");

chrome.storage.local.get("apiKey").then((stored) => {
  if (typeof stored.apiKey === "string") key.value = stored.apiKey;
});

save.addEventListener("click", () => {
  void chrome.storage.local.set({ apiKey: key.value.trim() }).then(() => {
    note.textContent = key.value.trim()
      ? "Saved. Reload pages that are already open."
      : "Cleared. Using the built-in key if you built with .env.";
  });
});
