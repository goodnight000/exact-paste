#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hidden, checkKey } from '../scripts/setup-key.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
if (args.has('--help') || args.has('-h')) {
  console.log(`Exact Paste

  npm start                  build locally, open Chrome's extension installer
  npm start -- --no-open     build and print the folder without opening apps
  npm start -- --prompt-key  optionally add a TypeSafe key for Jev

Local matching needs no API key. You can also add a key in extension Settings.
`);
  process.exit(0);
}
if (Number(process.versions.node.split('.')[0]) < 22 ||
  (Number(process.versions.node.split('.')[0]) === 22 && Number(process.versions.node.split('.')[1]) < 15)) {
  console.error('Exact Paste needs Node 22.15 or newer. https://nodejs.org');
  process.exit(1);
}
function run(command, argv) {
  const result = spawnSync(command, argv, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} failed`);
}
function openApp(command, argv) {
  const child = spawn(command, argv, { stdio: 'ignore', detached: true });
  child.on('error', () => console.log('Could not open an app automatically. Follow the steps above.'));
  child.unref();
}
try {
  let withKey = false;
  if (args.has('--prompt-key')) {
    console.log('Optional Jev key: https://console.typesafe.ai/settings/keys');
    const key = await hidden('Paste TypeSafe API key (Enter skips): ');
    if (key) {
      if (!(await checkKey(key))) throw new Error('TypeSafe rejected the key. You can still build without one.');
      const path = join(root, '.env');
      const previous = existsSync(path) ? readFileSync(path, 'utf8') : '';
      const rest = previous.split(/\r?\n/).filter((line) => !/^\s*TYPESAFE_API_KEY\s*=/.test(line)).join('\n').trimEnd();
      writeFileSync(path, `${rest ? rest + '\n' : ''}TYPESAFE_API_KEY=${key}\n`, { mode: 0o600 });
      chmodSync(path, 0o600);
      withKey = true;
    }
  }
  if (!existsSync(join(root, 'node_modules'))) run('npm', ['ci']);
  run(process.execPath, [join(root, 'scripts/build.mjs'), ...(withKey ? ['--with-key'] : [])]);
  const dist = join(root, 'dist');
  console.log(`\nLoad this folder: ${dist}\n\n1. Open chrome://extensions in Chrome.\n2. Turn on Developer mode, then Load unpacked.\n3. Select the dist folder above, then reload your form tab.\n4. Pin Exact Paste and add your details in its popup.\n\nMatching runs locally. An optional key enables Jev.\n`);
  if (withKey) console.log('This personal build includes your API key. Do not share it. npm run package creates a key-free ZIP.');
  if (!args.has('--no-open')) {
    if (process.platform === 'darwin') {
      const installed = spawnSync('osascript', ['-e', 'id of application "Google Chrome"'], { stdio: 'ignore' });
      if (installed.status === 0) openApp('open', ['-a', 'Google Chrome', 'chrome://extensions']);
      openApp('open', [dist]);
    } else if (process.platform === 'win32') {
      openApp('explorer', [dist]);
    } else {
      openApp('xdg-open', [dist]);
      for (const command of ['google-chrome', 'chromium', 'chromium-browser']) {
        if (spawnSync('which', [command], { stdio: 'ignore' }).status === 0) {
          openApp(command, ['chrome://extensions']); break;
        }
      }
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
