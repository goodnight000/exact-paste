import { describe, expect, it, vi } from "vitest";
import { decide } from "../src/decide";
import { isNameLine, nameFastPath, nameSlot, personName, splitName } from "../src/names";
import { field } from "../eval/fields";
import type { JevAnswers, JevAsk } from "../src/types";

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
  it("keeps a potentially compound given name or double surname intact", async () => {
    const first = field("First name", "text", { autocomplete: "given-name" });
    const last = field("Last name", "text", { autocomplete: "family-name" });
    expect(nameFastPath(jane, first)).toBeNull();
    expect(nameFastPath(jane, last)).toBeNull();
    const gotFirst = await decide(jane, first, null);
    const gotLast = await decide(jane, last, null);
    expect(gotFirst.mode).toBe("whole");
    expect(gotLast.mode).toBe("whole");
    expect(nameFastPath("Gabriel García Márquez", last)).toBeNull();
  });

  it("does not pick a name when two people are present", () => {
    const first = field("First name", "text", { autocomplete: "given-name" });
    expect(nameFastPath(two, first)).toBeNull();
  });
});

describe("vault-style notes", () => {
  it("reads a name under its own Name label, among other capitalized lines", () => {
    expect(personName("Name\nNia Okonkwo\n\nCompany\nHybrid Audio\n\nTitle\nStaff Sound Designer")).toBe("Nia Okonkwo");
  });
});

describe("real-world name lines, on device", () => {
  const first = field("First name", "text", { autocomplete: "given-name" });
  const last = field("Last name", "text", { autocomplete: "family-name" });
  const cases: [string, string, string | null, string | null][] = [
    ["name next to a country line", "Elena Voss\n914 N Damen Ave\nChicago, IL 60622\nUnited States\nelena@voss.studio", "Elena", "Voss"],
    ["name next to a firm line", "Rafael Mendez\nMendez Electric\n347-555-0160", "Rafael", "Mendez"],
    ["greeting and sign-off around the name", "Hi Sam,\n\nsee you Thursday.\n\nCheers\nMaya Chen\nHybrid Audio", "Maya", "Chen"],
    ["honorific", "Dr. Maya Chen", "Maya", "Chen"],
    ["middle initial", "Maya J. Chen", "Maya", "Chen"],
    ["suffix", "Maya Chen Jr.", "Maya", "Chen"],
    ["angle-bracket email", "Maya Chen <maya.chen@hybrid.audio>", "Maya", "Chen"],
    ["comma then title", "Maya Chen, Staff Sound Designer", "Maya", "Chen"],
    ["tab then title", "Maya Chen\tStaff Sound Designer", "Maya", "Chen"],
    ["Last, First", "Chen, Maya", "Maya", "Chen"],
    ["Guest: label", "Guest: Maya Chen\nTable 12", "Maya", "Chen"],
    ["labelled parts", "First name: Maya\nLast name: Chen", "Maya", "Chen"],
    ["two particles", "Ana de la Cruz", "Ana", "de la Cruz"],
    ["script without case needs explicit part labels", "王小明\nwang@x.com", null, null],
    // Nothing on device. These used to paste a wrong word.
    ["four-word line with a title", "Maya Chen Sound Designer", null, null],
    ["a job title alone", "Senior Sound Designer", null, null],
    ["a company alone", "Hybrid Audio\nhello@hybrid.audio", null, null],
    ["a sign-off alone", "Thank You", null, null],
    ["city, state without ZIP", "San Francisco, CA", null, null],
    ["two people", "Rafael Mendez\nChris Lang", null, null],
  ];
  for (const [id, clip, wantFirst, wantLast] of cases) {
    it(id, () => {
      expect(nameFastPath(clip, first)?.value ?? null).toBe(wantFirst);
      expect(nameFastPath(clip, last)?.value ?? null).toBe(wantLast);
    });
  }
});

describe("name field labels", () => {
  it("does not split names for essay questions or conflicting machine metadata", () => {
    expect(nameSlot(field("Describe the first name you chose for your product", "textarea"))).toBeNull();
    expect(nameSlot(field("Describe your issue", "textarea", { name: "first_name", autocomplete: "given-name" }))).toBeNull();
  });
  it("recognises common variants", () => {
    expect(nameSlot(field("Forename", "text"))).toBe("first");
    expect(nameSlot(field("First", "text"))).toBe("first");
    expect(nameSlot(field("", "text", { name: "fname" }))).toBe("first");
    expect(nameSlot(field("", "text", { name: "lname" }))).toBe("last");
    expect(nameSlot(field("Last", "text"))).toBe("last");
    expect(nameSlot(field("First line of address", "text"))).toBeNull();
  });
});

describe("first/last through Jev", () => {
  it("asks for the full name, then splits it in code", async () => {
    const ask: JevAsk = vi.fn(async (_state, questions): Promise<JevAnswers> => {
      const pick = questions.pick as { criteria: Record<string, string> } | undefined;
      if (!pick) return { ok: { type: "noul" as const, noul: 0.95 } };
      const id = Object.keys(pick.criteria).find((key) => pick.criteria[key] === "Maya Chen") ?? "none";
      return {
        wants_extracted: { type: "noul" as const, noul: 0.95 },
        pick: { type: "choice" as const, choice: id, probabilities: { [id]: 0.9, none: 0.1 }, confidence: 0.9 },
      };
    });
    const clip = "Maya Chen\nSan Francisco";
    const first = field("First name", "text", { autocomplete: "given-name" });
    const got = await decide(clip, first, ask);
    expect(got).toMatchObject({ mode: "slice", value: "Maya", reason: "jev-pick-first" });
    expect((vi.mocked(ask).mock.calls[0]?.[0] as { field: { label: string } }).field.label).toBe("Full name");
  });
});
