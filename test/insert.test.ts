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

  it("appends an unmatched paste at the cursor without deleting existing text", () => {
    const el = document.createElement("input");
    el.value = "United States";
    el.selectionStart = 13;
    el.selectionEnd = 13;
    applyPaste(el, { mode: "whole", value: "entire email", reason: "none" }, "entire email");
    expect(el.value).toBe("United Statesentire email");
  });

  it("replaces only the selected words with a smart value", () => {
    const el = document.createElement("textarea"); el.value = "Dear old name, hello";
    el.setSelectionRange(5, 13);
    expect(applyPaste(el, { mode: "slice", value: "Maya Chen", reason: "match" }, "source")).toBe(true);
    expect(el.value).toBe("Dear Maya Chen, hello");
  });

  it("fills an empty field with the whole chunk when there is no slice", () => {
    const el = document.createElement("input");
    applyPaste(el, { mode: "whole", value: "entire email", reason: "none" }, "entire email");
    expect(el.value).toBe("entire email");
  });

  it("rejects a smart value that exceeds maxlength without shortening it", () => {
    const el = document.createElement("input"); el.maxLength = 8; el.value = "old";
    expect(applyPaste(el, { mode: "slice", value: "https://example.com", reason: "match" }, "source")).toBe(false);
    expect(el.value).toBe("old");
  });

  it("preserves the existing suffix when a normal selected paste has limited room", () => {
    const el = document.createElement("input"); el.maxLength = 5; el.value = "ABCDE";
    el.setSelectionRange(2, 3);
    applyPaste(el, { mode: "whole", value: "XYZ", reason: "none" }, "XYZ");
    expect(el.value).toBe("ABXDE");
  });

  it("honors maxlength zero", () => {
    const el = document.createElement("input"); el.maxLength = 0;
    expect(applyPaste(el, { mode: "slice", value: "x", reason: "match" }, "x")).toBe(false);
    expect(el.value).toBe("");
  });

  it("does not split an emoji at the native-paste length limit", () => {
    const el = document.createElement("textarea"); el.maxLength = 3;
    applyPaste(el, { mode: "whole", value: "AB😀", reason: "none" }, "AB😀");
    expect(el.value).toBe("AB");
  });

  it("measures CRLF answers using textarea's native newline normalization", () => {
    const el = document.createElement("textarea"); el.maxLength = 5;
    expect(applyPaste(el, { mode: "slice", value: "ab\r\ncd", reason: "match" }, "source")).toBe(true);
    expect(el.value).toBe("ab\ncd");
  });

  it("notifies listeners outside an open shadow root", () => {
    const host = document.createElement("div"); document.body.append(host);
    const root = host.attachShadow({ mode: "open" }); const el = document.createElement("input"); root.append(el);
    const events: string[] = []; host.addEventListener("input", () => events.push("input"));
    host.addEventListener("change", () => events.push("change"));
    insertValue(el, "hello"); expect(events).toEqual(["input", "change"]); host.remove();
  });
});
