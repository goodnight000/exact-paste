const status = document.getElementById("ep-status");
if (status) {
  const paint = () => {
    const state = document.documentElement.dataset.exactPaste;
    if (state === "on") status.textContent = "Exact Paste on";
    else if (state === "off") status.textContent = "Exact Paste off";
    else status.textContent = "Exact Paste not loaded";
  };
  paint();
  setInterval(paint, 400);
}
