import { describe, expect, it, vi } from "vitest";
import { field } from "../eval/fields";
import { matchSavedFields, resolvePaste } from "../src/resolve";

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
      reason: "vault-template-header",
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

  it("preserves copied conflicting headers instead of substituting the vault", async () => {
    const clipboard = "LinkedIn: https://linkedin.com/in/first\nLinkedIn URL: https://linkedin.com/in/second";
    expect(await resolvePaste(clipboard, vault, linkedin, null)).toMatchObject({ value: clipboard, mode: "whole", reason: "ambiguous-template-conflicting-headers" });
  });

  it("preserves unlabelled competing emails instead of choosing a saved email", async () => {
    const clipboard = "first@example.com\nsecond@example.com";
    expect(await resolvePaste(clipboard, vault, email, null)).toMatchObject({ value: clipboard, mode: "whole" });
  });

  it("uses a saved platform URL rather than pasting an unrelated website URL", async () => {
    expect(await resolvePaste("https://github.com/me", vault, linkedin, null)).toMatchObject({ value: "https://www.linkedin.com/in/you", mode: "slice", reason: "vault-template-header" });
  });

  it("preserves a complete copied essay rather than replacing it with a saved answer", async () => {
    const clipboard = "We are building a useful tool.";
    const target = field("What are you building?", "textarea");
    const saved = [{ label: target.label, value: "Old answer" }];
    expect(await resolvePaste(clipboard, "", target, null, saved)).toMatchObject({ value: clipboard, mode: "whole" });
  });

  it("uses a missing saved application answer when the copy has exact other form headers", async () => {
    const target = field("Why did you pick this idea?", "textarea", { nearby: ["What are you building?"] });
    const value = "We experienced the problem firsthand.\n## A literal subheading\nThe thesis: make it easier.";
    const saved = [{ label: target.label, value }];
    expect(await resolvePaste("What are you building?\nA useful tool.", "", target, null, saved)).toEqual({ value, mode: "slice", reason: "profile-field" });
  });

  it("does not treat an unrelated Markdown essay heading as another application field", async () => {
    const target = field("Why did you pick this idea?", "textarea", { nearby: ["What are you building?"] });
    const clipboard = "# Our story\nWe learned from customers.";
    const saved = [{ label: target.label, value: "Saved answer" }];
    expect(await resolvePaste(clipboard, "", target, null, saved)).toMatchObject({ value: clipboard, mode: "whole" });
  });

  it("matches direct saved fields without reparsing literal headings in their values", async () => {
    const value = "We explain Markdown.\r\n## This is part of the answer\r\nThe thesis: preserve it.\r\n" + "detail\n".repeat(2000);
    const target = field("What are you building?", "textarea");
    const saved = [{ label: target.label, value }];
    expect(matchSavedFields(saved, target)).toEqual({ value, mode: "slice", reason: "profile-field" });
    expect(await resolvePaste("", "", target, null, saved)).toEqual({ value, mode: "slice", reason: "profile-field" });
  });

  it("gives exact copied answers precedence over saved fields", async () => {
    const clipboard = "LinkedIn: https://linkedin.com/in/new";
    const saved = [{ label: "LinkedIn URL", value: "https://linkedin.com/in/saved" }];
    expect(await resolvePaste(clipboard, "", linkedin, null, saved)).toMatchObject({ value: "https://linkedin.com/in/new", mode: "slice", reason: "template-header" });
  });

  it("rejects conflicting and empty saved rows without falling back to notes", async () => {
    const conflict = [
      { label: "LinkedIn", value: "https://linkedin.com/in/first" },
      { label: "LinkedIn URL", value: "https://linkedin.com/in/second" },
    ];
    expect(await resolvePaste("", vault, linkedin, null, conflict)).toEqual({ value: "", mode: "whole", reason: "ambiguous-profile-conflict" });
    expect(await resolvePaste("", vault, linkedin, null, [{ label: "LinkedIn", value: "" }])).toEqual({ value: "", mode: "whole", reason: "ambiguous-profile-empty" });
  });

  it("validates saved platform values and accepts matching known aliases", async () => {
    expect(matchSavedFields([{ label: "LinkedIn URL", value: "https://github.com/me" }], linkedin)).toMatchObject({ mode: "whole", reason: "profile-shape" });
    expect(matchSavedFields([{ label: "Email", value: "you@example.com" }], email)).toEqual({ value: "you@example.com", mode: "slice", reason: "profile-field" });
    expect(matchSavedFields([{ label: "Personal email", value: "you@example.com" }], field("Work email", "email"))).toBeNull();
    expect(matchSavedFields([{ label: "LinkedIn URL", value: "https://linkedin.com/in/me" }], field("Your LinkedIn profile", "url"))).toMatchObject({ mode: "slice", value: "https://linkedin.com/in/me" });
  });
});
