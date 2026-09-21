import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
if (!existsSync(join(dist, "manifest.json"))) {
  console.error("Run npm run build first.");
  process.exit(1);
}

const chrome =
  process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : process.platform === "win32"
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : "google-chrome";

if (!existsSync(chrome) && process.platform === "darwin") {
  console.error("Google Chrome not found.");
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: false,
  pipe: true,
  enableExtensions: [dist],
  defaultViewport: null,
  args: [
    "--enable-unsafe-extension-debugging",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${join(homedir(), ".exact-paste", "chrome-profile")}`,
  ],
});

const page = (await browser.pages())[0] ?? (await browser.newPage());
await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
console.log("Chrome is open with Exact Paste loaded. Leave this terminal running.");
console.log("The Keel bar should say Exact Paste on. Copy the email, paste into Recipient.");
await new Promise(() => {});
