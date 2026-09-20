import { describe, expect, it } from "vitest";
import { scoreDecide } from "../eval/score";

describe("scoreDecide", () => {
  it("passes when the inserted text is an accepted value", () => {
    const row = scoreDecide(
      "x",
      "abc",
      { mode: "slice", value: "a" },
      { mode: "slice", value: "a", reason: "jev-pick" },
      10,
    );
    expect(row.verdict).toBe("pass");
  });

  it("counts a whole paste as a safe miss when a slice was required", () => {
    const row = scoreDecide(
      "x",
      "abc",
      { mode: "slice", value: "a" },
      { mode: "whole", value: "abc", reason: "not-extracted" },
      10,
    );
    expect(row.verdict).toBe("safe_miss");
  });

  it("counts a wrong slice as unsafe", () => {
    const row = scoreDecide(
      "x",
      "Alex and Jordan",
      { mode: "slice", value: "Alex" },
      { mode: "slice", value: "Jordan", reason: "jev-pick" },
      10,
    );
    expect(row.verdict).toBe("unsafe");
  });

  it("counts slicing when the whole chunk was required as unsafe", () => {
    const clip = "Dear hiring team,\n\nHello.";
    const row = scoreDecide(
      "x",
      clip,
      { mode: "whole", value: clip },
      { mode: "slice", value: "Dear hiring team,", reason: "jev-pick" },
      10,
    );
    expect(row.verdict).toBe("unsafe");
  });
});
