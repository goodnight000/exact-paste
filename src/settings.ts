export function isEnabled(stored: { enabled?: unknown }): boolean {
  return stored.enabled !== false;
}

export function vaultText(stored: { vault?: unknown }): string {
  return typeof stored.vault === "string" ? stored.vault : "";
}

export function pasteSettingsChanged(changes: object, area: string): boolean {
  return area === "local" && ["enabled", "apiKey", "profile", "vault"].some((key) => key in changes);
}
