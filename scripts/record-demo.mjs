import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { launchFixture, shortcut, ready, root } from './browser-test.mjs';

await mkdir(join(root, '.local'), { recursive: true });
await mkdir(join(root, 'docs'), { recursive: true });
await writeFile(join(root, '.local/demo-brief.md'), `README screen walkthrough. Silent, real Chrome extension, 1280x800, normal speed.\nShow adding saved profile values, Save, copy a complete application once, paste into individual fields, then paste full multiline responses. No fabricated values, submission, personal session, API calls, music, or effects. Source sample is fictional.\n`);
const app = await launchFixture();
const { page, worker, origin, extensionOrigin } = app;
const pause = (ms = 1100) => new Promise((resolve) => setTimeout(resolve, ms));
let recorder;
try {
  await worker.evaluate(() => chrome.storage.local.clear());
  await page.goto(`${extensionOrigin}/options.html`); await page.bringToFront();
  await page.waitForFunction(() => !document.querySelector('main').inert);
  recorder = await page.screencast({ path: join(root, '.local/demo-source.webm'), format: 'webm', fps: 15 });
  await pause();
  const fields = [
    ['linkedin', 'LinkedIn', 'https://www.linkedin.com/in/maya-oduya'],
    ['email', 'Email', 'maya@tallyhand.co'],
    ['name', 'Name', 'Maya Oduya'],
    ['github', 'GitHub', 'https://github.com/maya'],
    ['phone', 'Phone', '+1 415 555 0100'],
  ];
  for (const [kind, label, value] of fields) {
    await page.click(`.add button[data-kind=${kind}]`);
    await page.type(`#rows .value[aria-label="${label}"]`, value, { delay: 10 });
    await pause(450);
  }
  await page.click('#save'); await page.waitForFunction(() => document.querySelector('#status').textContent === 'Saved');
  const storage = await worker.evaluate(() => chrome.storage.local.get(['profile', 'vault']));
  assert.equal(storage.profile.fields.length, 5); assert.match(storage.vault, /LinkedIn:/);
  await page.screenshot({ path: join(root, '.local/settings-real.png') });
  await pause(1800);
  await page.goto(`${origin}/demo/application.html`); await ready(page); await page.bringToFront();
  await page.click('#copy'); await page.waitForFunction(() => document.querySelector('#copy').textContent === 'Copied');
  const source = await page.$eval('#source', (el) => el.textContent);
  await pause(1400);
  const answers = [
    ['input[name=linkedin]', 'https://www.linkedin.com/in/maya-oduya'],
    ['input[name=email]', 'maya@tallyhand.co'],
    ['input[name=name]', 'Maya Oduya'],
    ['input[name=phone]', '+1 415 555 0100'],
    ['input[name=github]', 'https://github.com/maya'],
    ['input[name=website]', 'https://tallyhand.co'],
    ['textarea[name=about]', source.split('## About your company\n')[1].split('\n\n## What are you building?')[0]],
    ['textarea[name=building]', source.split('## What are you building?\n')[1].split('\n\n## Why did you pick this idea?')[0]],
    ['textarea[name=why]', source.split('## Why did you pick this idea?\n')[1].split('\n\n## How far along are you?')[0]],
  ];
  for (const [selector, expected] of answers) {
    await page.click(selector); await shortcut(page, 'v');
    await page.waitForFunction((selector, expected) => document.querySelector(selector).value === expected,
      { timeout: 6500 }, selector, expected);
    await pause(1200);
  }
  await pause(1800);
  await recorder.stop(); recorder = null;
  console.log('Recorded genuine profile setup and 9 successful pastes from one clipboard copy.');
} finally { await recorder?.stop(); await app.close(); }

for (const args of [
  ['-y', '-i', join(root, '.local/demo-source.webm'), '-c:v', 'libx264', '-crf', '22', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(root, 'docs/exact-paste-demo.mp4')],
  ['-y', '-i', join(root, 'docs/exact-paste-demo.mp4'), '-vf', 'fps=8,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3', '-loop', '0', join(root, 'docs/exact-paste-demo.gif')],
]) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Demo encoding failed');
}
console.log('README video: docs/exact-paste-demo.mp4 and animated preview.');
