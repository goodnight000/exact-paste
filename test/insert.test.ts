import { describe, expect, it } from "vitest";
import { applyPaste } from "../src/apply";
import { insertValue } from "../src/insert";

describe("insertValue", () => {
  it("writes the focused input and fires input + change", () => {
    const el = document.createElement("input");
    const events: string[] = [];
    el.addEventListener("input", () => events.push("input"));
    el.addEventListener("change", () => events.push("change"));
    insertValue(el, "marcus@anything.com");
    expect(el.value).toBe("marcus@anything.com");
    expect(events).toEqual(["input", "change"]);
  });

  it("does not dump the whole chunk over an existing value when the slice fails", () => {
    const el = document.createElement("input");
    el.value = "United States";
    el.selectionStart = 13;
    el.selectionEnd = 13;
    applyPaste(el, { mode: "whole", value: "entire email", reason: "none" }, "entire email");
    expect(el.value).toBe("United States");
  });

  it("fills an empty field with the whole chunk when there is no slice", () => {
    const el = document.createElement("input");
    applyPaste(el, { mode: "whole", value: "entire email", reason: "none" }, "entire email");
    expect(el.value).toBe("entire email");
  });
});
