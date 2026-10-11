export type ProfileField = { kind: string; label: string; value: string };
export type Profile = { version: 1; fields: ProfileField[]; notes: string };

export function vaultFrom(profile: Profile): string {
  const filled = profile.fields.map((f) => ({ label: f.label.trim(), value: f.value.trim() }))
    .filter((f) => f.label && f.value);
  if (!filled.length) return profile.notes;
  const lines = filled.filter((f) => !f.value.includes("\n")).map((f) => `${f.label}: ${f.value}`);
  const sections = filled.filter((f) => f.value.includes("\n")).map((f) => `## ${f.label}\n${f.value}`);
  return [lines.join("\n"), profile.notes.trim(), ...sections].filter(Boolean).join("\n\n");
}

export function readProfile(raw: unknown): Profile | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<Profile>;
  if (value.version !== 1 || !Array.isArray(value.fields) || typeof value.notes !== "string") return null;
  if (!value.fields.every((field) => field && typeof field.label === "string" &&
    typeof field.value === "string" && typeof field.kind === "string")) return null;
  return { version: 1, fields: value.fields.map((field) => ({ ...field })), notes: value.notes };
}

export function savedSource(stored: { profile?: unknown; vault?: unknown }): {
  text: string; fields?: ProfileField[];
} {
  const text = typeof stored.vault === "string" ? stored.vault : "";
  const profile = readProfile(stored.profile);
  // A changed legacy vault takes precedence over an out-of-date structured copy.
  if (!profile || vaultFrom(profile) !== text) return { text };
  return { text: profile.notes, fields: profile.fields };
}
