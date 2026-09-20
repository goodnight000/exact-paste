import { decide } from "../src/decide";
import { createAsk } from "../src/jev";
import { BAKED_API_KEY } from "./baked";
import type { FieldInfo } from "../src/types";

async function apiKey(): Promise<string> {
  const stored = await chrome.storage.local.get("apiKey");
  const fromStore = typeof stored.apiKey === "string" ? stored.apiKey.trim() : "";
  return fromStore || BAKED_API_KEY.trim();
}

chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  void (async () => {
    const key = await apiKey();
    if (message?.type === "status") {
      reply({ ready: Boolean(key) });
      return;
    }
    if (message?.type !== "decide") {
      reply({ value: "", mode: "whole", reason: "unknown" });
      return;
    }
    const text = typeof message.text === "string" ? message.text : "";
    const field = message.field as FieldInfo;
    if (!key) {
      reply({ value: text, mode: "whole", reason: "no-key" });
      return;
    }
    const decision = await decide(text, field, createAsk(key));
    reply(decision);
  })();
  return true;
});
