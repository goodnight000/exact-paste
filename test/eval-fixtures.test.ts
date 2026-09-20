import { describe, expect, it } from "vitest";
import { decideFixtures } from "../eval/decide-fixtures";
import { expectedValues } from "../eval/score";
import { slotFixtures } from "../eval/slot-fixtures";
import { decide } from "../src/decide";
import { isSlot } from "../src/field";

describe("slot fixtures", () => {
  for (const fixture of slotFixtures) {
    it(fixture.id, () => {
      document.body.innerHTML = fixture.html;
      const el = document.querySelector(fixture.focus);
      expect(el, fixture.focus).toBeTruthy();
      expect(isSlot(el)).toBe(fixture.expect.slot);
    });
  }
});

describe("decide fixtures are well-formed", () => {
  it("every expected slice is a substring of the clipboard", () => {
    for (const fixture of decideFixtures) {
      for (const value of expectedValues(fixture.clipboard, fixture.expect)) {
        expect(fixture.clipboard.includes(value), `${fixture.id}: missing ${JSON.stringify(value)}`).toBe(true);
      }
    }
  });
});

describe("decide fast path and secrets (no Jev)", () => {
  const byId = Object.fromEntries(decideFixtures.map((fixture) => [fixture.id, fixture]));

  it("marcus-email uses the only email", async () => {
    const fixture = byId["marcus-email"];
    const got = await decide(fixture.clipboard, fixture.field, null);
    expect(got).toMatchObject({ mode: "slice", value: "marcus@anything.com", reason: "one-email" });
  });

  it("labelled-phone uses the only phone", async () => {
    const fixture = byId["labelled-phone"];
    const got = await decide(fixture.clipboard, fixture.field, null);
    expect(got.mode).toBe("slice");
    expect(got.value).toBe("+1 (415) 555-0142");
  });

  it("private keys and card-shaped text dump the whole chunk", async () => {
    for (const id of ["secret-key", "secret-card"]) {
      const fixture = byId[id];
      const got = await decide(fixture.clipboard, fixture.field, null);
      expect(got.mode, id).toBe("whole");
      expect(got.value, id).toBe(fixture.clipboard);
    }
  });

  it("prompt-inject still takes the only email", async () => {
    const fixture = byId["prompt-inject"];
    const got = await decide(fixture.clipboard, fixture.field, null);
    expect(got).toMatchObject({ mode: "slice", value: "priya.shah@example.com" });
  });
});
