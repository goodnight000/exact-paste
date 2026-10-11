import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { launchFixture, pasteInto, setClipboard, shortcut, ready, root } from './browser-test.mjs';

const html = `<!doctype html><form>
<label>Email<input type="email" id="email"></label>
<label>LinkedIn URL<input type="url" id="linkedin"></label>
<label for="question">What are you building?</label><textarea id="question"></textarea>
<label>Referral code<input id="referral"></label>
<label>LinkedIn URL<input type="url" id="limited" maxlength="8" value="old"></label>
<label>Comments<textarea id="comments"></textarea></label>
<label>Search<input type="search" id="search"></label>
<label>Password<input type="password" id="password"></label>
<input type="email" id="frame-email">
</form><div id="shadow"></div><iframe srcdoc="<label>Email<input type='email' id='inner-email'></label>" id="frame"></iframe>`;
const app = await launchFixture(html);
const { page, worker, origin, browser, extensionOrigin } = app;
let passed = 0;
const check = (name) => { passed++; console.log(`PASS ${name}`); };
try {
  await worker.evaluate(() => chrome.storage.local.set({ enabled: true, apiKey: '', vault:
    'Name: Maya Oduya\nLinkedIn: https://www.linkedin.com/in/saved-maya\nEmail: saved@example.com\nGitHub: https://github.com/maya\nPhone: +1 415 555 0100' }));
  await page.goto(`${origin}/fixture.html`); await ready(page);
  await pasteInto(page, '#email', 'Name: Maya\nEmail: copied@example.com', 'copied@example.com'); check('trusted clipboard email');
  await pasteInto(page, '#referral', 'Referral code: SPRING-2026\nEmail: someone@example.com', 'SPRING-2026'); check('custom labelled text field');
  await pasteInto(page, '#linkedin', 'An unrelated clipboard note', 'https://www.linkedin.com/in/saved-maya'); check('saved LinkedIn fallback without a key');
  await pasteInto(page, '#linkedin', 'GitHub: https://github.com/wrong-person', 'https://www.linkedin.com/in/saved-maya'); check('wrong-platform URL cannot replace LinkedIn');
  const huge = '## Background\n' + 'Long source paragraph.\n'.repeat(20000) + '\n## Email\ncopied-late@example.com';
  await pasteInto(page, '#email', huge, 'copied-late@example.com'); check('header after 440k characters');
  const answer = 'Exact first paragraph.\n\nThe plan:\n' + 'Keep this complete.\n'.repeat(1000) + '\n### Internal details\nLiteral heading stays in the answer.';
  const template = `## What are you building?\n${answer}\n\n## Why this idea?\nAnother answer.`;
  await pasteInto(page, '#question', template, answer); check('complete 19k multiline answer with nested heading');
  const conflict = 'Email: one@example.com\nEmail: two@example.com';
  await page.$eval('#email', (el) => { el.value = ''; });
  await pasteInto(page, '#email', conflict, conflict.replace(/\n/g, '')); check('conflicting headers do not borrow saved email');
  const rejected = await page.$eval('#limited', (el) => new Promise((resolve) => {
    let input = false; el.addEventListener('input', () => { input = true; });
    setTimeout(() => resolve(input), 800);
  }));
  assert.equal(rejected, false);
  await setClipboard(page, 'LinkedIn: https://www.linkedin.com/in/too-long');
  await page.click('#limited'); await shortcut(page, 'v');
  await page.waitForFunction(() => document.querySelector('#exact-paste-toast')?.textContent?.includes('Nothing pasted'));
  assert.equal(await page.$eval('#limited', (el) => el.value), 'old'); check('maxlength refusal preserves complete existing value');
  await page.evaluate(() => {
    const el = document.querySelector('#linkedin'); el.value = ''; el.focus();
    const data = new DataTransfer(); data.setData('text/plain', 'probe');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(await page.$eval('#linkedin', (el) => el.value), ''); check('synthetic paste cannot read profile');
  for (const selector of ['#comments', '#search', '#password']) {
    await pasteInto(page, selector, 'Email: native@example.com', 'Email: native@example.com'); check(`${selector} stays native`);
  }
  await page.$eval('#email', (el) => { el.value = ''; });
  const plain = 'Email: plain@example.com';
  await setClipboard(page, plain); await page.click('#email'); await shortcut(page, 'v', true);
  await page.waitForFunction((plain) => document.querySelector('#email').value === plain, {}, plain);
  check('real Shift+paste stays native');
  const frame = await (await page.$('#frame')).contentFrame();
  await ready(frame);
  await setClipboard(page, 'Email: iframe@example.com'); await frame.click('#inner-email'); await shortcut(page, 'v');
  await frame.waitForFunction(() => document.querySelector('#inner-email').value === 'iframe@example.com');
  check('same-origin srcdoc frame receives exact paste');
  await page.evaluate(() => {
    const shadow = document.querySelector('#shadow').attachShadow({ mode: 'open' });
    shadow.innerHTML = '<span id="label">LinkedIn URL</span><input type="url" aria-labelledby="label">';
    window.shadowInputEvents = 0;
    document.addEventListener('input', (event) => { if (event.target.id === 'shadow') window.shadowInputEvents++; });
  });
  await setClipboard(page, 'LinkedIn: https://www.linkedin.com/in/shadow-maya');
  const shadowInput = await page.$('#shadow >>> input'); await shadowInput.click(); await shortcut(page, 'v');
  await page.waitForFunction(() => document.querySelector('#shadow').shadowRoot.querySelector('input').value === 'https://www.linkedin.com/in/shadow-maya');
  assert.equal(await page.evaluate(() => window.shadowInputEvents), 1); check('open shadow root and composed input');
  const savedAnswer = 'First paragraph.\n\n## Internal heading\nDetails: preserve this exactly.';
  const profile = { version: 1, fields: [{ kind: 'custom', label: 'What are you building?', value: savedAnswer }], notes: '' };
  await worker.evaluate((profile) => chrome.storage.local.set({ profile, vault: `## What are you building?\n${profile.fields[0].value}` }), profile);
  await ready(page);
  await pasteInto(page, '#question', 'Email: unrelated@example.com', savedAnswer);
  check('structured multiline profile preserves literal headings');
  await worker.evaluate(() => chrome.storage.local.remove('profile'));
  await worker.evaluate(() => chrome.storage.local.set({ vault: 'Name: Maya Oduya\nLinkedIn: https://www.linkedin.com/in/saved-maya\nEmail: saved@example.com\nGitHub: https://github.com/maya\nPhone: +1 415 555 0100' }));
  await worker.evaluate(() => chrome.storage.local.set({ enabled: false }));
  await page.waitForFunction(() => document.documentElement.dataset.exactPaste === 'off');
  await pasteInto(page, '#linkedin', 'LinkedIn: https://www.linkedin.com/in/native', 'LinkedIn: https://www.linkedin.com/in/native', { selectAll: true }); check('off toggle uses native paste');
  await worker.evaluate(() => chrome.storage.local.set({ enabled: true })); await ready(page);
  await page.goto(`${origin}/demo/application.html`); await ready(page);
  const source = await page.$eval('#source', (el) => el.textContent);
  await pasteInto(page, 'input[name=email]', source, 'maya@tallyhand.co'); check('application clipboard overrides saved email');
  await pasteInto(page, 'input[name=linkedin]', source, 'https://www.linkedin.com/in/maya-oduya'); check('application clipboard LinkedIn');
  await pasteInto(page, 'input[name=github]', source, 'https://github.com/maya'); check('application missing GitHub comes from saved profile');
  const building = source.split('## What are you building?\n')[1].split('\n\n## Why did you pick this idea?')[0];
  await pasteInto(page, 'textarea[name=building]', source, building); check('application multiline question');
  await mkdir(join(root, '.local'), { recursive: true });
  await page.screenshot({ path: join(root, '.local/application-verified.png'), fullPage: true });

  // Exercise the real settings bundle and Chrome storage, including rejected saves and session drafts.
  const initialProfile = { version: 1, fields: [
    { kind: 'linkedin', label: 'LinkedIn', value: 'https://www.linkedin.com/in/saved-maya' },
    { kind: 'email', label: 'Email', value: 'saved@example.com' },
    { kind: 'website', label: 'Website', value: 'maya.dev' },
    { kind: 'custom', label: 'Referral code', value: 'SPRING-2026' },
  ], notes: '' };
  const initialVault = initialProfile.fields.map((field) => `${field.label}: ${field.value}`).join('\n');
  await worker.evaluate(async ({ profile, vault }) => {
    await chrome.storage.session.remove('optionsDraft');
    await chrome.storage.local.set({ profile, vault, apiKey: '' });
  }, { profile: initialProfile, vault: initialVault });
  const openOptions = async () => {
    const options = await browser.newPage();
    await options.goto(`${extensionOrigin}/options.html`);
    await options.waitForFunction(() => !document.querySelector('main').inert);
    return options;
  };
  const edit = async (options, selector, value) => options.$eval(selector, (el, value) => {
    el.value = value; el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  let options = await openOptions();
  await edit(options, '#rows li:nth-child(1) .value', 'https://github.com/wrong-platform');
  await options.click('#save');
  await options.waitForFunction(() => document.querySelector('#status').textContent.includes("isn't a linkedin.com link"));
  assert.equal(await options.$eval('#rows li:nth-child(1) .value', (el) => el.getAttribute('aria-invalid')), 'true');
  assert.deepEqual(await worker.evaluate(async () => (await chrome.storage.local.get('profile')).profile), initialProfile);
  await options.screenshot({ path: join(root, '.local/settings-validation.png'), fullPage: true });
  check('settings reject wrong-platform link without writing storage');
  await edit(options, '#rows li:nth-child(1) .value', 'linkedin.com/in/maya');
  await edit(options, '#rows li:nth-child(2) .value', 'maya@');
  await options.click('#save');
  await options.waitForFunction(() => document.querySelector('#status').textContent.includes("email address isn't valid"));
  assert.deepEqual(await worker.evaluate(async () => (await chrome.storage.local.get('profile')).profile), initialProfile);
  check('settings reject malformed email without writing storage');
  await edit(options, '#rows li:nth-child(2) .value', 'maya@example.com');
  await options.click('#save');
  await options.waitForFunction(() => document.querySelector('#status').textContent === 'Saved');
  const updatedProfile = structuredClone(initialProfile);
  updatedProfile.fields[0].value = 'linkedin.com/in/maya';
  updatedProfile.fields[1].value = 'maya@example.com';
  assert.deepEqual(await worker.evaluate(async () => (await chrome.storage.local.get('profile')).profile), updatedProfile);
  check('settings accept bare URLs and save valid profile');
  await edit(options, '#rows li:nth-child(4) .value', 'UNSAVED-DRAFT');
  await options.waitForFunction(async () => (await chrome.storage.session.get('optionsDraft')).optionsDraft?.profile.fields[3].value === 'UNSAVED-DRAFT');
  await options.close(); options = await openOptions();
  assert.equal(await options.$eval('#rows li:nth-child(4) .value', (el) => el.value), 'UNSAVED-DRAFT');
  assert.deepEqual(await worker.evaluate(async () => (await chrome.storage.local.get('profile')).profile), updatedProfile);
  await options.click('#discard');
  assert.equal(await options.$eval('#rows li:nth-child(4) .value', (el) => el.value), 'SPRING-2026');
  check('session draft survives closing settings and discard restores saved values');
  await options.close();
  await worker.evaluate(async () => {
    await chrome.storage.session.remove('optionsDraft');
    await chrome.storage.local.remove('profile');
    await chrome.storage.local.set({ vault: 'Legacy note\nEmail: legacy@example.com' });
  });
  options = await openOptions();
  assert.equal(await options.$eval('#notes', (el) => el.value), 'Legacy note\nEmail: legacy@example.com');
  await edit(options, '#notes', 'Legacy note\nEmail: legacy@example.com\nAnother note');
  await options.click('#save');
  await options.waitForFunction(() => document.querySelector('#status').textContent === 'Saved');
  assert.equal(await worker.evaluate(async () => (await chrome.storage.local.get('vault')).vault), 'Legacy note\nEmail: legacy@example.com\nAnother note');
  check('legacy vault migrates without losing notes');
  await options.close();
  await worker.evaluate(() => chrome.storage.local.set({ vault: 'Changed elsewhere\nEmail: current@example.com' }));
  options = await openOptions();
  assert.equal(await options.$eval('#notes', (el) => el.value), 'Changed elsewhere\nEmail: current@example.com');
  assert.equal(await options.$eval('#rows', (el) => el.querySelectorAll('.value').length), 0);
  check('settings use current vault when structured profile has drifted');
  await options.close();
  console.log(`${passed} real-browser checks passed. No Jev calls or personal browser session used.`);
} finally { await app.close(); }
