import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { launchFixture, pasteInto, setClipboard, shortcut, smartShortcut, ready, root } from './browser-test.mjs';

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
  const welcomeTarget = await browser.waitForTarget(target => target.url() === `${extensionOrigin}/welcome.html`, { timeout: 10000 });
  const welcome = await welcomeTarget.asPage();
  assert.ok(welcome, 'fresh installation must open the practice page');
  check('fresh install opens onboarding without setup or a key');
  await worker.evaluate(() => chrome.storage.local.set({ enabled: true, useSaved: true, apiKey: '', vault:
    'Name: Maya Oduya\nLinkedIn: https://www.linkedin.com/in/saved-maya\nEmail: saved@example.com\nGitHub: https://github.com/maya\nPhone: +1 415 555 0100' }));
  await page.goto(`${origin}/fixture.html`); await ready(page);
  await page.evaluate(() => {
    window.nativeEvents=[];
    for(const type of ['paste','beforeinput','input']) document.querySelector('#referral').addEventListener(type,event=>window.nativeEvents.push({type,trusted:event.isTrusted}));
  });
  await pasteInto(page,'#referral','abc','abc',{smart:false});
  await pasteInto(page,'#referral','xyz','abcxyz',{smart:false,selectAll:false});
  assert.ok((await page.evaluate(()=>window.nativeEvents)).some(event=>event.type==='paste'&&event.trusted));
  assert.ok((await page.evaluate(()=>window.nativeEvents)).some(event=>event.type==='beforeinput'&&event.trusted));
  check('normal paste appends and preserves native site paste/beforeinput events');
  await page.$eval('#referral',el=>{el.value='';});
  await setClipboard(page,'Referral code: NEW'); await page.focus('#referral'); await page.keyboard.type('OLD'); await shortcut(page,'a'); await smartShortcut(page);
  await page.waitForFunction(()=>document.querySelector('#referral').value==='NEW');
  await page.keyboard.down(process.platform==='darwin'?'Meta':'Control');
  await page.keyboard.press('z',{commands:['undo']}); await page.keyboard.up(process.platform==='darwin'?'Meta':'Control');
  assert.equal(await page.$eval('#referral',el=>el.value),'OLD'); check('native undo restores an existing value after smart replacement');
  await setClipboard(page,'Referral code: Maya Chen'); await page.focus('#referral');
  await page.$eval('#referral',el=>{el.value='Dear old name, hello';el.setSelectionRange(5,13);}); await smartShortcut(page);
  await page.waitForFunction(()=>document.querySelector('#referral').value==='Dear Maya Chen, hello');
  check('smart paste replaces only the selected words');
  await page.click('#exact-paste-toast button:nth-of-type(2)');
  await page.waitForFunction(()=>document.querySelector('#referral').value==='Dear Referral code: Maya Chen, hello');
  check('paste-original action restores and uses the original selection');
  await worker.evaluate(()=>chrome.storage.local.set({useSaved:false})); await page.reload(); await ready(page);
  await setClipboard(page,'Contact support at help@vendor.com.'); await page.focus('#email'); await smartShortcut(page);
  await page.waitForFunction(()=>document.querySelector('#exact-paste-toast')?.textContent.includes('Choose before inserting'));
  assert.equal(await page.$eval('#email',el=>el.value),'');
  await page.evaluate(()=>document.querySelector('#exact-paste-toast button').click());
  assert.equal(await page.$eval('#email',el=>el.value),'');
  check('inferred values require a genuine user choice; synthetic clicks cannot fill');
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('#email',el=>document.activeElement===el),true);
  check('Escape dismisses choices and returns keyboard focus to the field');
  await page.evaluate(()=>navigator.clipboard.writeText('')); await page.focus('#linkedin'); await smartShortcut(page);
  await page.waitForFunction(()=>document.querySelector('#exact-paste-toast')?.textContent.includes('Paste original'));
  assert.equal(await page.$eval('#linkedin',el=>el.value),'');
  assert.equal(await page.evaluate(()=>document.querySelector('#exact-paste-toast').textContent.includes('Use saved detail')),false);
  check('saved details remain unavailable until explicitly enabled');
  await worker.evaluate(()=>chrome.storage.local.set({useSaved:true})); await page.reload(); await ready(page);
  await page.focus('#linkedin'); await smartShortcut(page);
  await page.waitForFunction(()=>document.querySelector('#exact-paste-toast')?.textContent.includes('Use saved detail'));
  assert.equal(await page.$eval('#linkedin',el=>el.value),'');
  await page.click('#exact-paste-toast button');
  await page.waitForFunction(()=>document.querySelector('#linkedin').value==='https://www.linkedin.com/in/saved-maya');
  check('a genuinely empty clipboard offers enabled saved details for confirmation');
  await worker.evaluate(()=>{
    globalThis.__realFetch=globalThis.fetch; globalThis.__providerCalls=0;
    globalThis.fetch=async()=>{globalThis.__providerCalls++;throw new Error('No live requests allowed in verification');};
    return chrome.storage.local.set({apiKey:'verification-only-fake-key'});
  });
  await page.reload(); await ready(page); await setClipboard(page,'Contact support at help@vendor.com.'); await page.focus('#email'); await smartShortcut(page);
  await page.waitForFunction(()=>document.querySelector('#exact-paste-toast')?.textContent.includes('Ask Jev'));
  assert.equal(await worker.evaluate(()=>globalThis.__providerCalls),0);
  await pasteInto(page,'#referral','local text','local text',{smart:false});
  assert.equal(await worker.evaluate(()=>globalThis.__providerCalls),0);
  await worker.evaluate(()=>{globalThis.fetch=globalThis.__realFetch;return chrome.storage.local.set({apiKey:''});});
  await page.reload(); await ready(page);
  check('adding a key does not send local smart paste or normal paste to AI');
  await pasteInto(page, '#email', 'Name: Maya\nEmail: copied@example.com', 'copied@example.com'); check('trusted clipboard email');
  await pasteInto(page, '#referral', 'Referral code: SPRING-2026\nEmail: someone@example.com', 'SPRING-2026'); check('custom labelled text field');
  await pasteInto(page, '#linkedin', 'An unrelated clipboard note', 'https://www.linkedin.com/in/saved-maya'); check('saved LinkedIn fallback without a key');
  await pasteInto(page, '#linkedin', 'GitHub: https://github.com/wrong-person', 'https://www.linkedin.com/in/saved-maya'); check('wrong-platform URL cannot replace LinkedIn');
  const huge = '## Background\n' + 'Long source paragraph.\n'.repeat(20000) + '\n## Email\ncopied-late@example.com';
  await pasteInto(page, '#email', huge, 'copied-late@example.com'); check('header after 460k characters');
  const varied = '## Background\n' + Array.from({ length: 12000 }, (_, index) =>
    `Paragraph ${index} contains different text about the application and its history.\n`).join('') + '\n## Email\nvaried-late@example.com';
  await pasteInto(page, '#email', varied, 'varied-late@example.com'); check('late header in a large template with varied prose');
  const whitespace = '# A' + ' '.repeat(100000) + 'B\n## Email\nwhitespace@example.com';
  await pasteInto(page, '#email', whitespace, 'whitespace@example.com'); check('pathological whitespace cannot stall header matching');
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
  await page.click('#limited'); await smartShortcut(page);
  await page.waitForFunction(() => document.querySelector('#exact-paste-toast')?.textContent?.includes('could not be inserted'));
  assert.equal(await page.$eval('#limited', (el) => el.value), 'old'); check('maxlength refusal preserves complete existing value');
  await page.evaluate(() => {
    const el = document.querySelector('#linkedin'); el.value = ''; el.focus();
    const data = new DataTransfer(); data.setData('text/plain', 'probe');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(await page.$eval('#linkedin', (el) => el.value), ''); check('synthetic paste cannot read profile');
  for (const selector of ['#comments', '#search', '#password']) {
    await pasteInto(page, selector, 'Email: native@example.com', 'Email: native@example.com', {smart:false}); check(`${selector} stays native`);
  }
  await page.$eval('#email', (el) => { el.value = ''; });
  const plain = 'Email: plain@example.com';
  await setClipboard(page, plain); await page.click('#email'); await shortcut(page, 'v', true);
  await page.waitForFunction((plain) => document.querySelector('#email').value === plain, {}, plain);
  check('real Shift+paste stays native');
  const frame = await (await page.$('#frame')).contentFrame();
  await ready(frame);
  await setClipboard(page, 'Email: iframe@example.com'); await frame.click('#inner-email'); await smartShortcut(page);
  await frame.waitForFunction(() => document.querySelector('#inner-email').value === 'iframe@example.com');
  check('same-origin srcdoc frame receives exact paste');
  await page.evaluate(() => {
    const shadow = document.querySelector('#shadow').attachShadow({ mode: 'open' });
    shadow.innerHTML = '<span id="label">LinkedIn URL</span><input type="url" aria-labelledby="label">';
    window.shadowInputEvents = 0;
    document.addEventListener('input', (event) => { if (event.target.id === 'shadow') window.shadowInputEvents++; });
  });
  await setClipboard(page, 'LinkedIn: https://www.linkedin.com/in/shadow-maya');
  const shadowInput = await page.$('#shadow >>> input'); await shadowInput.click(); await smartShortcut(page);
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
  await pasteInto(page, '#linkedin', 'LinkedIn: https://www.linkedin.com/in/native', 'LinkedIn: https://www.linkedin.com/in/native', { selectAll: true, smart:false }); check('disabled shortcut leaves normal paste native');
  await worker.evaluate(() => chrome.storage.local.set({ enabled: true })); await ready(page);
  await page.goto(`${origin}/demo/application.html`); await ready(page);
  const source = await page.$eval('#source', (el) => el.textContent);
  await pasteInto(page, 'input[name=email]', source, 'maya@tallyhand.co'); check('application clipboard overrides saved email');
  const covered = await page.evaluate(() => {
    const panel = document.querySelector('#exact-paste-toast'); const r = panel.getBoundingClientRect();
    const field = document.activeElement;
    return [...document.querySelectorAll('input,textarea,label,button,a[href],summary')]
      .filter(el => el !== field && !el.contains(field) && !panel.contains(el))
      .filter(el => { const box=el.getBoundingClientRect(); return box.width && box.height &&
        box.right>r.left && box.left<r.right && box.bottom>r.top && box.top<r.bottom; })
      .map(el=>el.id||el.textContent.slice(0,50));
  });
  assert.deepEqual(covered,[]); check('success feedback leaves other fields and their labels unobstructed');
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
  // Hold the worker response while a background page writes inactive storage.
  // This recreates the race without a model request or a timing-dependent sleep.
  await page.bringToFront();
  const pageSession = await page.createCDPSession();
  const contexts = [];
  pageSession.on('Runtime.executionContextCreated', ({ context }) => { contexts.push(context); });
  await pageSession.send('Runtime.enable');
  let contentContext;
  for (const context of contexts.filter((context) => !context.auxData?.isDefault)) {
    const { result } = await pageSession.send('Runtime.evaluate', {
      expression: 'typeof chrome !== "undefined" && chrome.runtime?.id', contextId: context.id, returnByValue: true,
    });
    if (result.value === new URL(extensionOrigin).host) { contentContext = context.id; break; }
  }
  assert.ok(contentContext, 'extension content context must be available');
  await pageSession.send('Runtime.evaluate', { contextId: contentContext, expression: `
    globalThis.__pasteTestStorageChange = new Promise((resolve) => {
      const listener = (changes, area) => {
        if (area !== 'local' || !changes.backgroundDraftProbe) return;
        chrome.storage.onChanged.removeListener(listener); resolve(true);
      };
      chrome.storage.onChanged.addListener(listener);
    }); true;
  ` });
  const workerTarget = browser.targets().find((target) => target.type() === 'service_worker');
  const debuggerSession = await workerTarget.createCDPSession();
  await debuggerSession.send('Debugger.enable');
  const paused = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Worker debugger did not pause')), 4000);
    debuggerSession.once('Debugger.paused', () => { clearTimeout(timer); resolve(); });
  });
  const pauseTrigger = debuggerSession.send('Runtime.evaluate', { expression: 'debugger;' });
  await paused;
  try {
    await page.bringToFront();
    await setClipboard(page, 'Email: pending@example.com');
    await page.click('input[name=email]'); await shortcut(page, 'a'); await smartShortcut(page);
    await options.evaluate(() => chrome.storage.session.set({ optionsDraft: {
      profile: { version: 1, fields: [], notes: 'Unsaved background edit' }, apiKey: '',
    } }));
    await options.evaluate(() => chrome.storage.local.set({ backgroundDraftProbe: 'Inactive metadata' }));
    const acknowledgement = await pageSession.send('Runtime.evaluate', {
      contextId: contentContext, expression: '__pasteTestStorageChange', awaitPromise: true, timeout: 3000,
    });
    assert.equal(acknowledgement.result.value, true, 'content script must observe the inactive storage write');
  } finally {
    await debuggerSession.send('Debugger.resume'); await pauseTrigger; await debuggerSession.detach();
    await pageSession.detach();
  }
  await page.waitForFunction(() => document.querySelector('input[name=email]').value === 'pending@example.com', { timeout: 6500 });
  check('unsaved drafts and unrelated storage do not cancel a pending paste');
  await options.close();
  await welcome.bringToFront();
  await welcome.waitForFunction(() => document.querySelector('#smart-keys kbd'));
  const sample = await welcome.$eval('#sample', el => el.textContent);
  const expectedEmail = sample.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]+/)[0];
  await welcome.click('#copy');
  await welcome.waitForFunction(() => document.querySelector('#copy').textContent.includes('Copied'));
  assert.equal(await welcome.evaluate(() => navigator.clipboard.readText()), sample);
  check('onboarding Copy writes only the fictional sample');
  await welcome.click('#email'); await smartShortcut(welcome);
  await welcome.waitForFunction(expected => document.querySelector('#email').value === expected, {}, expectedEmail);
  check('onboarding uses the real shortcut and local matching');
  await welcome.click('#exact-paste-toast button');
  await welcome.waitForFunction(() => document.querySelector('#email').value === '');
  check('onboarding Undo restores the practice field');
  await welcome.click('#email'); await shortcut(welcome, 'v');
  assert.equal(await welcome.$eval('#email', el => el.value), sample.replace(/\r\n?|\n/g, ' '));
  check('onboarding normal paste keeps the entire sample');
  await welcome.click('#clear');
  await worker.evaluate(() => chrome.storage.local.set({ enabled: false }));
  await welcome.waitForFunction(() => !document.querySelector('#turn-on').hidden);
  await smartShortcut(welcome);
  assert.equal(await welcome.$eval('#email', el => el.value), '');
  await welcome.click('#turn-on');
  await welcome.waitForFunction(() => document.querySelector('#turn-on').hidden);
  check('onboarding explains the disabled shortcut and lets users enable it');
  await welcome.click('#settings');
  const settingsTarget = await browser.waitForTarget(target => target.url() === `${extensionOrigin}/options.html`);
  const settingsPage = await settingsTarget.asPage();
  await settingsPage.bringToFront(); await settingsPage.waitForSelector('#tutorial');
  await settingsPage.click('#tutorial');
  await browser.waitForTarget(target => target.url() === `${extensionOrigin}/welcome.html` && target !== welcomeTarget);
  check('settings can reopen the tutorial');
  console.log(`${passed} real-browser checks passed. No Jev calls or personal browser session used.`);
} finally { await app.close(); }
