import { copyFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { launchFixture, ready, smartShortcut, root } from './browser-test.mjs';

// Capture the real extension with fictional data. No personal profile or AI calls.
const output = join(root, 'docs/store');
await mkdir(output, { recursive: true });
const app = await launchFixture();
const { page, worker, origin, extensionOrigin } = app;
try {
  await worker.evaluate(() => chrome.storage.local.set({ enabled: true, apiKey: '', useSaved: false }));
  await page.goto(`${extensionOrigin}/welcome.html`); await page.bringToFront();
  await page.waitForSelector('#smart-keys kbd');
  await page.screenshot({ path: join(output, 'onboarding.png') });
  await page.goto(`${extensionOrigin}/options.html`);
  await page.waitForFunction(() => !document.querySelector('main').inert);
  await page.screenshot({ path: join(output, 'settings.png') });
  await page.goto(`${origin}/demo/application.html`); await ready(page);
  await page.click('#copy');
  await page.waitForFunction(() => document.querySelector('#copy').textContent === 'Copied');
  await page.click('input[name=email]'); await smartShortcut(page);
  await page.waitForFunction(() => document.querySelector('input[name=email]').value === 'maya@tallyhand.co');
  await page.screenshot({ path: join(output, 'smart-paste.png') });
  const icon = resolve(root, process.env.EXACT_PASTE_EXTENSION_DIR ?? 'dist', 'icons/128.png');
  await copyFile(icon, join(output, 'icon.png'));
  await page.setViewport({ width: 440, height: 280 });
  await page.goto(`${extensionOrigin}/welcome.html`);
  await page.setContent(`<!doctype html><style>
    *{box-sizing:border-box}body{margin:0;width:440px;height:280px;display:grid;place-content:center;
    background:#22684f;color:white;font-family:system-ui;text-align:center}
    img{width:92px;height:92px;margin:auto}h1{margin:8px 0 0;font-size:32px;letter-spacing:-1px}
    p{margin:12px 0 0;font-size:17px;color:#d3e8df}
    </style><img src="${extensionOrigin}/icons/128.png" alt=""><h1>Exact Paste</h1><p>Copy once. Paste precisely.</p>`);
  await page.waitForFunction(() => document.querySelector('img').complete && document.querySelector('img').naturalWidth === 128);
  await page.screenshot({ path: join(output, 'promo.png') });
  console.log('Store assets: three 1280x800 screenshots, 440x280 promo, 128x128 icon in docs/store.');
} finally { await app.close(); }
