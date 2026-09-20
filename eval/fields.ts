import type { FieldInfo, FieldKind } from "../src/types";

export function field(
  label: string,
  kind: FieldKind,
  extra: Partial<FieldInfo> = {},
): FieldInfo {
  return {
    type: kind === "textarea" ? "textarea" : kind === "text" ? "text" : kind,
    name: "",
    id: "",
    autocomplete: extra.autocomplete ?? "",
    placeholder: extra.placeholder ?? "",
    tag: kind === "textarea" ? "textarea" : "input",
    nearby: extra.nearby ?? [],
    ...extra,
    label,
    kind,
  };
}

export const jobNearby = [
  "Full name",
  "Email address",
  "Current location",
  "X / Twitter profile",
  "Current company",
  "Current role",
  "Professional summary",
];
