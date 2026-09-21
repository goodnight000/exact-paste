import { decide } from "./decide";
import type { Decision, FieldInfo, JevAsk } from "./types";

export async function resolvePaste(
  clipboard: string,
  vault: string,
  field: FieldInfo,
  ask: JevAsk | null,
): Promise<Decision> {
  if (clipboard) {
    const fromCopy = await decide(clipboard, field, ask);
    if (fromCopy.mode === "slice") return fromCopy;
  }
  const note = vault.trim();
  if (note) {
    const fromVault = await decide(note, field, ask);
    if (fromVault.mode === "slice") {
      return { value: fromVault.value, mode: "slice", reason: `vault-${fromVault.reason}` };
    }
  }
  return {
    value: clipboard,
    mode: "whole",
    reason: clipboard ? "clipboard-whole" : "empty",
  };
}
