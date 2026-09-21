import { describe, expect, it } from "vitest";
import { isEnabled } from "../src/settings";

describe("isEnabled", () => {
  it("defaults to on", () => {
    expect(isEnabled({})).toBe(true);
  });

  it("turns off only when set to false", () => {
    expect(isEnabled({ enabled: false })).toBe(false);
    expect(isEnabled({ enabled: true })).toBe(true);
  });
});
