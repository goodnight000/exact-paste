import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
export async function launchFixture(fixture = '') {
  const paths = [process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
  const executablePath = paths.find((path) => existsSync(path));
  if (!executablePath) throw new Error('Chrome not found. Set CHROME_PATH to your Chrome executable.');
  const server = createServer(async (request, response) => {
    try {
      const path = new URL(request.url, 'http://localhost').pathname;
      if (path === '/fixture.html') { response.setHeader('Content-Type', 'text/html'); response.end(fixture); return; }
      const file = path.slice(1) || 'demo/application.html';
      if (!/^(?:demo|dist)\/[\w./-]+$/.test(file) || file.includes('..')) { response.writeHead(404).end(); return; }
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
      response.setHeader('Content-Type', types[extname(file)] ?? 'text/plain');
      response.end(await readFile(join(root, file)));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath, headless: !process.argv.includes('--headed'),
      pipe: true, enableExtensions: [join(root, 'dist')],
      defaultViewport: { width: 1280, height: 800 },
      args: ['--enable-unsafe-extension-debugging', '--no-first-run', '--no-default-browser-check'] });
    await browser.defaultBrowserContext().overridePermissions(origin, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
    const target = await browser.waitForTarget((target) => target.type() === 'service_worker', { timeout: 10000 });
    const worker = await target.worker();
    const extensionUrl = new URL(target.url());
    const extensionOrigin = `${extensionUrl.protocol}//${extensionUrl.host}`;
    const page = (await browser.pages())[0] ?? await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      window.addEventListener('paste', (event) => {
        window.lastNativePaste = { trusted: event.isTrusted, length: event.clipboardData?.getData('text/plain').length };
      }, true);
    });
    return { browser, page, worker, origin, extensionOrigin,
      close: async () => { await browser.close(); await new Promise((resolve) => server.close(resolve)); } };
  } catch (error) {
    await browser?.close(); server.close(); throw error;
  }
}

export async function ready(page) {
  await page.waitForFunction(() => document.documentElement.dataset.exactPaste === 'on');
}
export async function pasteInto(page, selector, text, expected, { selectAll = false } = {}) {
  await page.bringToFront();
  await setClipboard(page, text);
  await page.click(selector);
  if (selectAll) await shortcut(page, 'a');
  await shortcut(page, 'v');
  try {
    await page.waitForFunction((selector, expected) => document.querySelector(selector).value === expected,
      { timeout: 6500 }, selector, expected);
  } catch (error) {
    const state = await page.$eval(selector, (el) => ({ length: el.value.length, preview: el.value.slice(0, 80),
      active: document.activeElement === el, enabled: document.documentElement.dataset.exactPaste,
      paste: window.lastNativePaste }));
    throw new Error(`Paste check failed (${selector}): ${JSON.stringify(state)}`, { cause: error });
  }
  return page.$eval(selector, (el) => el.value);
}

export async function setClipboard(page, text) {
  await page.bringToFront();
  await page.evaluate((text) => {
    const source = document.createElement('textarea'); source.id = 'native-copy-source';
    source.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px';
    source.value = text; document.body.append(source); source.focus(); source.select();
  }, text);
  await shortcut(page, 'c');
  await page.waitForFunction(async (text) => await navigator.clipboard.readText() === text.replace(/\r\n?/g, '\n'),
    { timeout: 5000 }, text);
  await page.evaluate(() => document.querySelector('#native-copy-source').remove());
}

export async function shortcut(page, key, shift = false) {
  await page.keyboard.down(modifier);
  if (shift) await page.keyboard.down('Shift');
  // Chrome's headless macOS path needs an explicit native editing command.
  const command = { a: 'selectAll', c: 'copy', v: shift ? 'pasteAndMatchStyle' : 'paste' }[key];
  try { await page.keyboard.press(key, command ? { commands: [command] } : {}); }
  finally { if (shift) await page.keyboard.up('Shift'); await page.keyboard.up(modifier); }
}
