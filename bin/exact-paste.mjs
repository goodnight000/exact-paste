#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { stdin as stdinStream, stdout } from "node:process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOME_INSTALL = join(homedir(), ".exact-paste");
const KEY_URL = "https://console.typesafe.ai/settings/keys";
const JEV = "https://api.typesafe.ai/v1/systemone";

const args = new Set(process.argv.slice(2));
const help = args.has("-h") || args.has("--help");
const noOpen = args.has("--no-open");
const forcePrompt = args.has("--prompt-key");

if (help) {
  console.log(`Exact Paste

  npm start                  install, ask for a TypeSafe key, open Chrome
  TYPESAFE_API_KEY=… npm start
  npm start -- --no-open     skip Finder / Chrome
  npm start -- --prompt-key  ask even if a key is already set
`);
  process.exit(0);
}

function run(command, argv, cwd) {
  const result = spawnSync(command, argv, { cwd, stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    throw new Error(`${command} ${argv.join(" ")} failed`);
  }
}

function nodeMajor() {
  return Number(process.versions.node.split(".")[0]);
}

function existingKey(dir) {
  const fromEnv = (process.env.TYPESAFE_API_KEY ?? "").trim();
  if (fromEnv && !forcePrompt) return fromEnv;
  try {
    const text = readFileSync(join(dir, ".env"), "utf8");
    const line = text.split(/\n/).find((row) => row.startsWith("TYPESAFE_API_KEY="));
    const value = line ? line.slice("TYPESAFE_API_KEY=".length).trim() : "";
    if (value && !forcePrompt) return value;
  } catch {
    // no .env yet
  }
  return "";
}

function hidden(query) {
  return new Promise((resolve, reject) => {
    if (!stdinStream.isTTY) {
      const rl = createInterface({ input: stdinStream, output: stdout });
      rl.question(query, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
      return;
    }
    stdout.write(query);
    stdinStream.setRawMode(true);
    stdinStream.resume();
    let value = "";
    const onData = (chunk) => {
      const char = chunk.toString("utf8");
      if (char === "\n" || char === "\r") {
        cleanup();
        stdout.write("\n");
        resolve(value.trim());
        return;
      }
      if (char === "\u0003") {
        cleanup();
        stdout.write("\n");
        reject(new Error("cancelled"));
        return;
      }
      if (char === "\u007f" || char === "\b") {
        value = value.slice(0, -1);
        return;
      }
      if (char.length === 1 && char >= " ") {
        value += char;
        stdout.write("•");
      }
    };
    const cleanup = () => {
      stdinStream.off("data", onData);
      stdinStream.setRawMode(false);
      stdinStream.pause();
    };
    stdinStream.on("data", onData);
  });
}

async function checkKey(key) {
  const res = await fetch(JEV, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "jev-1.13.0",
      state: "ok",
      questions: { ping: { type: "noul", instructions: "Is this a short test string?" } },
    }),
  });
  if (res.status === 401 || res.status === 403) return false;
  if (!res.ok) throw new Error(`TypeSafe HTTP ${res.status}`);
  return true;
}

async function askKey(dir) {
  const have = existingKey(dir);
  if (have) {
    stdout.write("Checking TypeSafe key… ");
    const ok = await checkKey(have);
    if (ok) {
      console.log("ok");
      return have;
    }
    console.log("rejected");
  }
  console.log(`Get a key: ${KEY_URL}`);
  for (let i = 0; i < 3; i++) {
    const key = await hidden("Paste TypeSafe API key: ");
    if (!key) {
      console.log("Empty. Try again.");
      continue;
    }
    stdout.write("Checking… ");
    try {
      if (await checkKey(key)) {
        console.log("ok");
        return key;
      }
      console.log("that key was rejected.");
    } catch (error) {
      console.log(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error("Need a valid TypeSafe API key.");
}

function writeEnv(dir, key) {
  writeFileSync(join(dir, ".env"), `TYPESAFE_API_KEY=${key}\n`, { mode: 0o600 });
}

function openPath(target) {
  if (process.platform === "darwin") spawn("open", [target], { stdio: "ignore", detached: true }).unref();
  else if (process.platform === "win32") spawn("explorer", [target], { stdio: "ignore", detached: true }).unref();
  else spawn("xdg-open", [target], { stdio: "ignore", detached: true }).unref();
}

function openChromeExtensions() {
  if (process.platform === "darwin") {
    const apps = ["Google Chrome", "Arc", "Brave Browser", "Microsoft Edge", "Chromium"];
    for (const app of apps) {
      const check = spawnSync("osascript", ["-e", `id of application "${app}"`], { encoding: "utf8" });
      if (check.status === 0) {
        spawn("open", ["-a", app, "chrome://extensions"], { stdio: "ignore", detached: true }).unref();
        return app;
      }
    }
  }
  const bin = ["google-chrome", "chromium", "brave-browser", "microsoft-edge"].find((name) => spawnSync("which", [name]).status === 0);
  if (bin) spawn(bin, ["chrome://extensions"], { stdio: "ignore", detached: true }).unref();
  return null;
}

function copyClipboard(text) {
  if (process.platform === "darwin") {
    const child = spawn("pbcopy");
    child.stdin.end(text);
  }
}

function writeNextStep(dist) {
  const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Exact Paste — one click left</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    font: 16px/1.45 "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
    background: Canvas;
    color: CanvasText;
  }
  main { width: min(36rem, calc(100% - 48px)); padding: 48px 0; }
  h1 { font-size: 22px; font-weight: 600; margin: 0 0 8px; }
  p { margin: 0 0 20px; opacity: 0.78; }
  ol { margin: 0; padding: 0 0 0 1.2em; }
  li { margin: 0 0 10px; }
  code {
    display: block;
    margin: 18px 0 22px;
    padding: 12px 14px;
    border: 1px solid color-mix(in srgb, CanvasText 16%, transparent);
    border-radius: 8px;
    font: 13px/1.4 "IBM Plex Mono", ui-monospace, Menlo, monospace;
    word-break: break-all;
    user-select: all;
  }
</style>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&family=IBM+Plex+Sans:wght@400;600&display=swap" />
<main>
  <h1>One click left</h1>
  <p>Chrome is on the extensions page. Developer mode (top right), then <b>Load unpacked</b>, then pick this folder:</p>
  <code>${dist}</code>
  <ol>
    <li>Turn on Developer mode.</li>
    <li>Load unpacked, select the folder above. Finder is open on it.</li>
    <li>Reload tabs that were already open. Paste into a form.</li>
  </ol>
</main>
`;
  const file = join(mkdtempSync(join(tmpdir(), "exact-paste-")), "next.html");
  writeFileSync(file, html);
  return file;
}

function installTarget() {
  const ephemeral = /[/\\]_npx[/\\]|[/\\]npm-cache[/\\]/.test(ROOT);
  return ephemeral ? HOME_INSTALL : ROOT;
}

function syncTo(target) {
  if (target === ROOT) return;
  mkdirSync(target, { recursive: true });
  run(
    "rsync",
    ["-a", "--delete", "--exclude", "node_modules", "--exclude", "dist", "--exclude", ".env", "--exclude", ".git", `${ROOT}/`, `${target}/`],
    ROOT,
  );
}

const dir = installTarget();
if (nodeMajor() < 22) {
  console.error("Exact Paste needs Node 22 or newer. https://nodejs.org");
  process.exit(1);
}

console.log("Exact Paste");
console.log("");

try {
  if (dir !== ROOT) {
    console.log(`Installing to ${dir}`);
    syncTo(dir);
  }
  const key = await askKey(dir);
  writeEnv(dir, key);
  if (!existsSync(join(dir, "node_modules"))) {
    console.log("Installing dependencies…");
    run("npm", ["install"], dir);
  }
  console.log("Building extension…");
  run("npm", ["run", "build"], dir);
  const dist = join(dir, "dist");
  writeFileSync(join(dist, "LOAD_THIS_FOLDER.txt"), `Load this folder in chrome://extensions (Developer mode → Load unpacked).\n${dist}\n`);
  copyClipboard(dist);
  if (!noOpen) {
    try {
      const probe = spawnSync("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", "http://127.0.0.1:4173/"], {
        encoding: "utf8",
      });
      if (probe.stdout?.trim() !== "200") {
        spawn("python3", ["-m", "http.server", "4173", "--directory", join(dir, "demo")], {
          cwd: dir,
          detached: true,
          stdio: "ignore",
        }).unref();
      }
    } catch {
      // demo server is optional
    }
    console.log("Opening Chrome with Exact Paste (current Chrome ignores --load-extension)…");
    run(process.execPath, [join(dir, "scripts/open-chrome.mjs")], dir);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
