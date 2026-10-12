const scenes = ["Ship:keel", "Vendor:vendor", "Bill:bill", "Guest:guest", "Links:links", "Apply:apply"];
const here = location.pathname.split("/").pop() || "index.html";
const menu = document.getElementById("ep-menu");
if (menu) {
  menu.innerHTML =
    `<b>Exact Paste</b><a href="index.html"${here === "index.html" ? " aria-current" : ""}>Scenes</a>` +
    scenes
      .map((row) => row.split(":"))
      .map(([name, file]) => `<a href="${file}.html"${here === `${file}.html` ? " aria-current" : ""}>${name}</a>`)
      .join("") +
    `<span class="status" id="ep-status"></span>`;
}

const status = document.getElementById("ep-status");
if (status) {
  const paint = () => {
    const state = document.documentElement.dataset.exactPaste ?? "";
    status.dataset.state = state;
    if (state === "on") status.textContent = "Smart paste: Alt / Option + Shift + V";
    else if (state === "off") status.textContent = "Smart-paste shortcut disabled";
    else status.textContent = "Exact Paste not loaded";
  };
  paint();
  setInterval(paint, 400);
}

// One click on a source selects all of it. A drag inside it selects too, instead of starting a text drag.
document.addEventListener("click", (event) => {
  const source = event.target.closest?.(".copy");
  if (source) getSelection().selectAllChildren(source);
});
document.addEventListener("dragstart", (event) => {
  if (event.target.closest?.(".copy")) event.preventDefault();
});
