export function isEnabled(stored: { enabled?: unknown }): boolean {
  return stored.enabled !== false;
}

export function vaultText(stored: { vault?: unknown }): string {
  return typeof stored.vault === "string" ? stored.vault : "";
}
