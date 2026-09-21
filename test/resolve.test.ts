import { describe, expect, it, vi } from "vitest";
import { field } from "../eval/fields";
import { resolvePaste } from "../src/resolve";

const vault = `LinkedIn
https://www.linkedin.com/in/you

Email
you@studio.com
`;

const linkedin = field("LinkedIn", "url", { placeholder: "https://linkedin.com/in/…" });
const email = field("Email address", "email", { autocomplete: "email" });

describe("resolvePaste", () => {
  it("uses the vault when the clipboard has no match", async () => {
    const got = await resolvePaste("", vault, linkedin, null);
    expect(got).toMatchObject({
      mode: "slice",
      value: "https://www.linkedin.com/in/you",
      reason: "vault-one-url",
    });
  });

  it("lets a copied URL beat the vault", async () => {
    const got = await resolvePaste("https://www.linkedin.com/in/other", vault, linkedin, null);
    expect(got).toMatchObject({
      mode: "slice",
      value: "https://www.linkedin.com/in/other",
      reason: "one-url",
    });
  });

  it("does not treat a leftover tweet as a copy win", async () => {
    const ask = vi.fn(async () => ({
      wants_extracted: { type: "noul" as const, noul: 0.1 },
      pick: {
        type: "choice" as const,
        choice: "whole",
        probabilities: { none: 0.1, whole: 0.9 },
        confidence: 0.2,
      },
    }));
    const got = await resolvePaste("just shipped a bowl lol", vault, linkedin, ask);
    expect(got.mode).toBe("slice");
    expect(got.value).toBe("https://www.linkedin.com/in/you");
    expect(got.reason.startsWith("vault-")).toBe(true);
  });

  it("uses vault email when the clipboard is empty", async () => {
    const got = await resolvePaste("", vault, email, null);
    expect(got).toMatchObject({ mode: "slice", value: "you@studio.com" });
  });
});
