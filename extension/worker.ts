import { decide } from "../src/decide";
import { createAsk } from "../src/jev";
import { isEnabled } from "../src/settings";
import { BAKED_API_KEY } from "./baked";
import type { FieldInfo } from "../src/types";

async function apiKey(): Promise<string> {
  const stored = await chrome.storage.local.get("apiKey");
  const fromStore = typeof stored.apiKey === "string" ? stored.apiKey.trim() : "";
  return fromStore || BAKED_API_KEY.trim();
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

chrome.runtime.onInstalled.addListener(() => {
  void paintAction();
});
chrome.runtime.onStartup.addListener(() => {
  void paintAction();
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled) void paintAction();
});
void paintAction();

chrome.commands.onCommand.addListener((command) => {
  if (command !== "toggle-exact-paste") return;
  void (async () => {
    const on = !(await enabled());
    await chrome.storage.local.set({ enabled: on });
  })();
});

chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  void (async () => {
    const key = await apiKey();
    const on = await enabled();
    if (message?.type === "status") {
      reply({ ready: Boolean(key) && on, enabled: on });
      return;
    }
    if (message?.type !== "decide") {
      reply({ value: "", mode: "whole", reason: "unknown" });
      return;
    }
    const text = typeof message.text === "string" ? message.text : "";
    const field = message.field as FieldInfo;
    if (!on) {
      reply({ value: text, mode: "whole", reason: "off" });
      return;
    }
    if (!key) {
      reply({ value: text, mode: "whole", reason: "no-key" });
      return;
    }
    const decision = await decide(text, field, createAsk(key));
    reply(decision);
  })();
  return true;
});
