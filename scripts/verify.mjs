import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const shots = "/tmp/exact-paste-verify";
mkdirSync(shots, { recursive: true });

const bill = `Please pay Norr Press LLC.

Invoice INV-8841
Amount due: 1240.00
Due: 12 May 2026

Remit to:
88 Bond Street
Brooklyn, NY 11222
United States

pay@norr.press
`;

const letter = `hi, please send the two bowls here, not the studio.

Elena Voss
914 N Damen Ave
Chicago, IL 60622
United States
elena@voss.studio
312-555-0198

buzzer 3B. I'm out Thursday.`;

async function pasteInto(page, selector, text) {
  return page.$eval(
    selector,
    (el, value) =>
      new Promise((resolve) => {
        const target = el;
        target.focus();
        const dt = new DataTransfer();
        dt.setData("text/plain", value);
        target.dispatchEvent(
          new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt }),
        );
        window.setTimeout(() => {
          resolve({
            value: target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target.value : "",
            flag: document.documentElement.dataset.exactPaste ?? "",
          });
        }, 800);
      }),
    text,
  );
}

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: false,
  pipe: true,
  enableExtensions: [dist],
  defaultViewport: { width: 1400, height: 900 },
  args: ["--enable-unsafe-extension-debugging", "--no-first-run", "--no-default-browser-check"],
});

const page = (await browser.pages())[0] ?? (await browser.newPage());
await page.goto("http://127.0.0.1:4173/bill.html", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1500));

const flag = await page.evaluate(() => document.documentElement.dataset.exactPaste ?? "");
const status = await page.$eval("#ep-status", (el) => el.textContent);
const workers = browser.targets().filter((t) => t.type() === "service_worker").map((t) => t.url());

console.log(JSON.stringify({ flag, status, workers }, null, 2));

const vendor = await pasteInto(page, 'input[name="vendor"]', bill);
const invoice = await pasteInto(page, 'input[name="invoice"]', bill);
const amount = await pasteInto(page, 'input[name="amount"]', bill);
await page.screenshot({ path: join(shots, "bill.png"), fullPage: true });

await page.goto("http://127.0.0.1:4173/keel.html", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 800));
const recipient = await pasteInto(page, 'input[name="name"]', letter);
const email = await pasteInto(page, 'input[name="email"]', letter);
const city = await pasteInto(page, 'input[name="city"]', letter);
const country = await pasteInto(page, 'input[name="country"]', letter);
await page.screenshot({ path: join(shots, "keel.png"), fullPage: true });

const rows = [
  ["bill.vendor", vendor.value, "Norr Press LLC"],
  ["bill.invoice", invoice.value, "INV-8841"],
  ["bill.amount", amount.value, "1240.00"],
  ["keel.recipient", recipient.value, "Elena Voss"],
  ["keel.email", email.value, "elena@voss.studio"],
  ["keel.city", city.value, "Chicago"],
  ["keel.country", country.value, "United States"],
];
let failed = 0;
for (const [id, got, want] of rows) {
  const ok = got === want;
  if (!ok) failed += 1;
  console.log(JSON.stringify({ id, ok, got, want }));
}
console.log(failed ? `FAILED ${failed}` : "ALL_OK");
console.log(`shots ${shots}`);
await new Promise(() => {});
