import { createAsk } from "../src/jev";
import { resolvePaste } from "../src/resolve";
import { isEnabled } from "../src/settings";
import { savedSource } from "../src/profile";
import { BAKED_API_KEY } from "./baked";
import type { FieldInfo, JevAsk } from "../src/types";

async function apiKey(): Promise<string> {
  const stored = await chrome.storage.local.get("apiKey");
  return typeof stored.apiKey === "string" ? stored.apiKey.trim() : BAKED_API_KEY.trim();
}

async function enabled(): Promise<boolean> {
  return isEnabled(await chrome.storage.local.get("enabled"));
}

async function paintAction(): Promise<void> {
  const on = await enabled();
  await chrome.action.setBadgeText({ text: on ? "" : "OFF" });
  await chrome.action.setBadgeBackgroundColor({ color: "#5c5c5c" });
  await chrome.action.setTitle({ title: on ? "Exact Paste is on" : "Exact Paste is off" });
}

chrome.runtime.onInstalled.addListener((details) => {
  void paintAction();
  if (details.reason === "install") void chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
});
chrome.runtime.onStartup.addListener(() => {
  void paintAction();
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled) void paintAction();
});
void paintAction();

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "smart-paste") return;
  void (async () => {
    if (!(await enabled())) return;
    const current = tab ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
    if (current?.url === chrome.runtime.getURL("welcome.html")) {
      await chrome.runtime.sendMessage({ type: "tutorial-smart-paste" });
    } else if (current?.id !== undefined) await chrome.tabs.sendMessage(current.id, { type: "smart-paste" });
  })().catch(() => undefined);
});

function validField(raw: unknown): raw is FieldInfo {
  if (!raw || typeof raw !== "object") return false;
  const field = raw as FieldInfo;
  return ["email", "url", "tel", "text", "textarea"].includes(field.kind) &&
    ["label", "type", "name", "id", "autocomplete", "placeholder", "tag"].every((key) =>
      typeof field[key as keyof FieldInfo] === "string") &&
    Array.isArray(field.nearby) && field.nearby.every((label) => typeof label === "string");
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  const text = typeof message?.text === "string" ? message.text : "";
  void (async () => {
    const key = await apiKey();
    const on = await enabled();
    if (message?.type === "status") {
      const commands = await chrome.commands.getAll();
      reply({ ready: on, enabled: on, jev: Boolean(key), shortcut: commands.find((item) => item.name === "smart-paste")?.shortcut ?? "" });
      return;
    }
    if (message?.type !== "decide") {
      reply({ value: "", mode: "whole", reason: "unknown" });
      return;
    }
    const field: unknown = message.field;
    if (sender.id !== chrome.runtime.id || !sender.tab) { reply({ value: text, mode: "whole", reason: "sender" }); return; }
    if (!validField(field)) {
      reply({ value: text, mode: "whole", reason: "invalid-field" });
      return;
    }
    if (!on) {
      reply({ value: text, mode: "whole", reason: "off" });
      return;
    }
    const stored = await chrome.storage.local.get(["vault", "profile", "useSaved"]);
    const source = stored.useSaved === true ? savedSource(stored) : { text: "", fields: [] };
    const started = performance.now();
    const provider = key && message.model === true ? createAsk(key) : null;
    const ask: JevAsk | null = provider ? (state, questions, timeoutMs) => {
      const remaining = 4500 - (performance.now() - started);
      if (remaining <= 0) return Promise.reject(new Error("Paste deadline"));
      return provider(state, questions, Math.max(1, Math.min(timeoutMs, Math.floor(remaining))));
    } : null;
    const decision = await resolvePaste(text, source.text, field, ask, source.fields);
    reply(decision);
  })().catch(() => reply({ value: text, mode: "whole", reason: "worker" }));
  return true;
});
