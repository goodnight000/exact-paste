import { describe, expect, it } from "vitest";
import { isEnabled, pasteSettingsChanged } from "../src/settings";

describe("isEnabled", () => {
  it("defaults to on", () => {
    expect(isEnabled({})).toBe(true);
  });

  it("turns off only when set to false", () => {
    expect(isEnabled({ enabled: false })).toBe(false);
    expect(isEnabled({ enabled: true })).toBe(true);
  });
});

describe("pasteSettingsChanged", () => {
  it("ignores unsaved session drafts and unrelated local writes", () => {
    expect(pasteSettingsChanged({ optionsDraft: { newValue: "draft" } }, "session")).toBe(false);
    expect(pasteSettingsChanged({ enabled: { newValue: false } }, "session")).toBe(false);
    expect(pasteSettingsChanged({ unrelated: { newValue: "anything" } }, "local")).toBe(false);
  });

  it("invalidates for active saved settings, including their removal", () => {
    for (const key of ["enabled", "apiKey", "profile", "vault"]) {
      expect(pasteSettingsChanged({ [key]: { newValue: "changed" } }, "local")).toBe(true);
      expect(pasteSettingsChanged({ [key]: { oldValue: "removed" } }, "local")).toBe(true);
    }
  });
});
