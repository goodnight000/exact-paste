import { describe, expect, it } from "vitest";
import { decide } from "../src/decide";
import { isNameLine, nameFastPath, personName, splitName } from "../src/names";
import { field } from "../eval/fields";

const jane = `Jane Mary Doe
jane.doe@example.net
+44 20 7946 0958
London, UK
`;

const two = `Alex Chen
alex@northstar.dev

Jordan Hale
jordan@studio.co
`;

describe("splitName", () => {
  it("splits a three-word name into first and last", () => {
    expect(splitName("Jane Mary Doe")).toEqual({
      full: "Jane Mary Doe",
      first: "Jane",
      middle: "Mary",
      last: "Doe",
    });
  });

  it("keeps particles on the last name", () => {
    expect(splitName("Ludwig van Beethoven").last).toBe("van Beethoven");
  });
});

describe("personName", () => {
  it("uses a labelled name", () => {
    expect(personName("Name: Priya Shah\nEmail: priya@x.test")).toBe("Priya Shah");
  });

  it("uses the only name-like line", () => {
    expect(personName(jane)).toBe("Jane Mary Doe");
  });

  it("refuses to guess when two people are in the chunk", () => {
    expect(personName(two)).toBeNull();
  });
});

describe("isNameLine", () => {
  it("accepts unicode names and rejects cities", () => {
    expect(isNameLine("Zoë García")).toBe(true);
    expect(isNameLine("San Francisco, CA")).toBe(false);
  });
});

describe("name fast path", () => {
  it("fills first and last name without Jev", async () => {
    const first = field("First name", "text", { autocomplete: "given-name" });
    const last = field("Last name", "text", { autocomplete: "family-name" });
    expect(nameFastPath(jane, first)).toEqual({ value: "Jane", reason: "first-name" });
    expect(nameFastPath(jane, last)).toEqual({ value: "Doe", reason: "last-name" });
    const gotFirst = await decide(jane, first, null);
    const gotLast = await decide(jane, last, null);
    expect(gotFirst).toMatchObject({ mode: "slice", value: "Jane", reason: "first-name" });
    expect(gotLast).toMatchObject({ mode: "slice", value: "Doe", reason: "last-name" });
  });

  it("does not pick a name when two people are present", () => {
    const first = field("First name", "text", { autocomplete: "given-name" });
    expect(nameFastPath(two, first)).toBeNull();
  });
});
