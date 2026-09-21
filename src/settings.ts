export function isEnabled(stored: { enabled?: unknown }): boolean {
  return stored.enabled !== false;
}
