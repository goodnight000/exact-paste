import { describe, expect, it } from "vitest";
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
});
